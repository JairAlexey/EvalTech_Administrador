import os
import tempfile
import subprocess
import logging
from datetime import datetime
from typing import List, Dict, Any
from events.s3_service import s3_service
from events.models import ParticipantLog

logger = logging.getLogger(__name__)


class VideoMergerService:
    """Servicio para unir videos de un participante en orden cronologico"""

    def __init__(self):
        # No crear temp_dir global para evitar colisiones en paralelo
        self.temp_dir = None

    def merge_participant_videos(self, participant_event_id: int) -> Dict[str, Any]:
        """
        Une todos los videos de un participante en orden cronologico
        y los sube a S3.
        """
        try:
            # Crear un directorio temporal por ejecucion
            self.temp_dir = tempfile.mkdtemp()
            logger.info(f"Using temp dir for merge: {self.temp_dir}")

            # Obtener todos los logs de video del participante ordenados por tiempo
            video_logs = ParticipantLog.objects.filter(
                participant_event_id=participant_event_id,
                name="audio/video",
                url__isnull=False,
            ).order_by("timestamp")

            if not video_logs.exists():
                return {
                    "success": False,
                    "error": "No video logs found for participant",
                    "skipped": True,
                    "skip_reason": "no_video_logs",
                }

            logger.info(
                f"Found {video_logs.count()} video files for participant_event {participant_event_id}"
            )

            # Descargar videos de S3 a archivos temporales
            video_files = []
            for log in video_logs:
                temp_file = self._download_video_from_s3(log.url)
                if temp_file:
                    video_files.append({"file": temp_file, "timestamp": log.timestamp})

            if not video_files:
                return {
                    "success": False,
                    "error": "No valid video files could be downloaded",
                }

            # Unir videos usando FFmpeg (subprocess)
            merged_video_path = self._merge_videos_with_ffmpeg(video_files)
            if not merged_video_path:
                return {"success": False, "error": "Failed to merge videos"}

            # Merge re-encodes to MP4 with fresh timestamps; skip extra sanitize pass
            sanitized_video_path = None
            upload_source = merged_video_path

            # Subir video unido a S3
            upload_result = self._upload_merged_video_to_s3(
                upload_source, participant_event_id
            )

            # Limpiar archivos temporales
            cleanup_list = video_files + [{"file": merged_video_path}]
            if sanitized_video_path:
                cleanup_list.append({"file": sanitized_video_path})
            self._cleanup_temp_files(cleanup_list)

            if upload_result["success"]:
                return {
                    "success": True,
                    "video_url": upload_result.get("presigned_url")
                    or upload_result.get("video_url"),
                    "video_key": upload_result.get("s3_key")
                    or upload_result.get("key"),
                    "s3_key": upload_result.get("s3_key")
                    or upload_result.get("key"),
                    "merged_count": len(video_files),
                }

            return {
                "success": False,
                "error": f"Failed to upload merged video: {upload_result.get('error', 'Unknown error')}",
            }

        except Exception as e:
            logger.error(
                f"Error merging videos for participant_event {participant_event_id}: {str(e)}"
            )
            return {"success": False, "error": str(e)}
        finally:
            # Asegurar limpieza del directorio temporal per-call
            if self.temp_dir and os.path.isdir(self.temp_dir):
                try:
                    os.rmdir(self.temp_dir)
                except Exception as e:
                    logger.debug(f"Temp dir not empty or already removed: {e}")

    def _download_video_from_s3(self, s3_url: str) -> str:
        """Descarga un video de S3 a un archivo temporal con timeout"""
        try:
            # Extraer la key del S3 desde la URL
            if "amazonaws.com" in s3_url:
                key = s3_url.split(".amazonaws.com/")[-1].split("?")[0]
            else:
                key = s3_url

            # Crear archivo temporal
            temp_file = os.path.join(
                self.temp_dir,
                f"video_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}.webm",
            )

            # Descargar desde S3 con timeout
            logger.info(f"Downloading video from S3: {key}")
            download_result = s3_service.download_file(key, temp_file)

            if download_result["success"]:
                if os.path.exists(temp_file) and os.path.getsize(temp_file) > 0:
                    logger.info(
                        f"Successfully downloaded video: {temp_file} ({os.path.getsize(temp_file)} bytes)"
                    )
                    return temp_file

                logger.error(f"Downloaded file is empty or doesn't exist: {temp_file}")
                return None

            logger.error(
                f"Failed to download video from S3: {download_result.get('error')}"
            )
            return None

        except Exception as e:
            logger.error(f"Error downloading video from S3: {str(e)}")
            return None

    def _check_ffmpeg_available(self) -> bool:
        """Verifica si FFmpeg esta disponible en el sistema"""
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"], capture_output=True, timeout=10
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _merge_videos_with_ffmpeg(self, video_files: List[Dict]) -> str:
        """Une videos usando FFmpeg con re-encode para normalizar timestamps"""
        try:
            if not self._check_ffmpeg_available():
                logger.error(
                    "FFmpeg not found. Please install FFmpeg and add it to system PATH"
                )
                logger.error("Download from: https://ffmpeg.org/download.html")
                return None

            if not video_files:
                logger.error("No input videos to merge")
                return None

            if len(video_files) == 1:
                logger.info(
                    "One input video, normalizing timestamps and encoding to MP4"
                )

            input_args = []
            filter_parts = []
            concat_inputs = []

            for idx, video_info in enumerate(video_files):
                input_args.extend(["-i", video_info["file"]])
                filter_parts.append(f"[{idx}:v]setpts=PTS-STARTPTS[v{idx}]")
                filter_parts.append(f"[{idx}:a]asetpts=PTS-STARTPTS[a{idx}]")
                concat_inputs.append(f"[v{idx}][a{idx}]")

            filter_complex = (
                ";".join(filter_parts)
                + ";"
                + "".join(concat_inputs)
                + f"concat=n={len(video_files)}:v=1:a=1[outv][outa]"
            )

            output_file = os.path.join(
                self.temp_dir,
                f"merged_video_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4",
            )

            cmd = [
                "ffmpeg",
                "-err_detect",
                "ignore_err",
                "-fflags",
                "+genpts",
            ]
            cmd += input_args
            cmd += [
                "-filter_complex",
                filter_complex,
                "-map",
                "[outv]",
                "-map",
                "[outa]",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "28",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                "-y",
                "-loglevel",
                "error",
                output_file,
            ]

            logger.info(
                f"Starting FFmpeg concat re-encode with {len(video_files)} files"
            )
            logger.info(f"FFmpeg command: {' '.join(cmd[:8])}... (truncated)")

            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=14400
            )  # up to 4 hours for long videos

            if result.returncode == 0:
                if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                    logger.info(
                        f"Successfully merged {len(video_files)} videos: {output_file} ({os.path.getsize(output_file)} bytes)"
                    )
                    return output_file

                logger.error(
                    "FFmpeg completed but output file is empty or doesn't exist"
                )
                return None

            logger.error(f"FFmpeg failed with return code {result.returncode}")
            if result.stderr:
                logger.error(f"FFmpeg error output: {result.stderr}")
            if result.stdout:
                logger.info(f"FFmpeg stdout: {result.stdout}")
            return None

        except subprocess.TimeoutExpired:
            logger.error("FFmpeg timeout during video merge (14400 seconds)")
            return None
        except FileNotFoundError:
            logger.error(
                "FFmpeg executable not found. Please install FFmpeg and add it to system PATH"
            )
            logger.error("Download from: https://ffmpeg.org/download.html")
            return None
        except Exception as e:
            logger.error(f"Error merging videos with FFmpeg: {str(e)}")
            return None

    def _sanitize_video(self, input_path: str) -> str:
        """
        Re-codifica el video unido para descartar paquetes/frames corruptos
        que puedan detener el analisis frame a frame.
        """
        try:
            if not self._check_ffmpeg_available():
                return None

            output_file = os.path.join(
                self.temp_dir,
                f"cleaned_video_{datetime.now().strftime('%Y%m%d_%H%M%S')}.mp4",
            )

            cmd = [
                "ffmpeg",
                "-err_detect",
                "ignore_err",
                "-i",
                input_path,
                "-fflags",
                "+genpts",
                "-c:v",
                "libx264",
                "-preset",
                "veryfast",
                "-crf",
                "28",
                "-c:a",
                "aac",
                "-b:a",
                "128k",
                "-movflags",
                "+faststart",
                "-loglevel",
                "error",
                "-y",
                output_file,
            ]

            logger.info("Sanitizing merged video (fast H.264/AAC) to avoid decode errors")
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=14400
            )  # up to 4 hours for long videos

            if result.returncode == 0 and os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                logger.info(
                    f"Sanitized video created: {output_file} ({os.path.getsize(output_file)} bytes)"
                )
                return output_file

            logger.error(
                f"Failed to sanitize video, using original merge. Return code: {result.returncode}, stderr: {result.stderr}"
            )
            return None
        except subprocess.TimeoutExpired:
            logger.error("Sanitize ffmpeg process timed out")
            return None
        except Exception as e:
            logger.error(f"Error sanitizing merged video: {str(e)}")
            return None

    def _upload_merged_video_to_s3(
        self, video_path: str, participant_event_id: int
    ) -> Dict[str, Any]:
        """Sube el video unido a S3"""
        try:
            with open(video_path, "rb") as video_file:
                upload_result = s3_service.upload_media_fragment(
                    video_file,
                    participant_event_id,
                    media_type="merged_video",
                    timestamp=datetime.now(),
                )

                if upload_result["success"]:
                    return {
                        "success": True,
                        "video_url": upload_result.get("presigned_url"),
                        "presigned_url": upload_result.get("presigned_url"),
                        "s3_key": upload_result["key"],
                        "key": upload_result["key"],
                    }

                return {
                    "success": False,
                    "error": upload_result.get(
                        "error", "Failed to upload or generate URL"
                    ),
                }

        except Exception as e:
            logger.error(f"Error uploading merged video to S3: {str(e)}")
            return {"success": False, "error": str(e)}

    def _cleanup_temp_files(self, files: List[Dict]):
        """Limpia archivos temporales"""
        for file_info in files:
            try:
                file_path = file_info.get("file")
                if file_path and os.path.exists(file_path):
                    os.remove(file_path)
            except Exception as e:
                logger.warning(f"Could not remove temp file {file_path}: {str(e)}")

        try:
            os.rmdir(self.temp_dir)
        except Exception as e:
            logger.warning(f"Could not remove temp directory {self.temp_dir}: {str(e)}")


# Instancia global del servicio
video_merger_service = VideoMergerService()
