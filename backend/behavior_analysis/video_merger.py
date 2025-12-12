import os
import tempfile
import subprocess
import logging
from datetime import datetime
from typing import List, Dict, Any
from django.conf import settings
from events.s3_service import s3_service
from events.models import ParticipantLog

try:
    import ffmpeg

    FFMPEG_PYTHON_AVAILABLE = True
except ImportError:
    FFMPEG_PYTHON_AVAILABLE = False

logger = logging.getLogger(__name__)


class VideoMergerService:
    """Servicio para unir videos de un participante en orden cronológico"""

    def __init__(self):
        # No crear temp_dir global para evitar colisiones en paralelo
        self.temp_dir = None

    def merge_participant_videos(self, participant_event_id: int) -> Dict[str, Any]:
        """
        Une todos los videos de un participante en orden cronológico
        y los sube a S3.

        Args:
            participant_event_id: ID del ParticipantEvent

        Returns:
            Dict con el resultado de la operación
        """
        try:
            # Crear un directorio temporal por ejecución
            self.temp_dir = tempfile.mkdtemp()
            logger.info(f"Using temp dir for merge: {self.temp_dir}")
            # Obtener todos los logs de video del participante ordenados por tiempo
            video_logs = ParticipantLog.objects.filter(
                participant_event_id=participant_event_id,
                name="audio/video",  # Cambié de 'video' a 'audio/video' según la BD
                url__isnull=False,
            ).order_by("timestamp")

            if not video_logs.exists():
                return {
                    "success": False,
                    "error": "No video logs found for participant",
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

            # Unir videos usando FFmpeg (probar ffmpeg-python primero, luego subprocess)
            merged_video_path = self._merge_videos_with_ffmpeg_python(video_files)
            if not merged_video_path:
                logger.info("Falling back to subprocess FFmpeg method")
                merged_video_path = self._merge_videos_with_ffmpeg(video_files)

            if not merged_video_path:
                return {"success": False, "error": "Failed to merge videos"}

            # Subir video unido a S3
            upload_result = self._upload_merged_video_to_s3(
                merged_video_path, participant_event_id
            )

            # Limpiar archivos temporales
            self._cleanup_temp_files(video_files + [{"file": merged_video_path}])

            if upload_result["success"]:
                return {
                    "success": True,
                    "video_url": upload_result["video_url"],
                    "merged_count": len(video_files),
                }
            else:
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
                # URL completa de S3
                key = s3_url.split(".amazonaws.com/")[-1].split("?")[0]
            else:
                # Podría ser solo la key
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
                # Verificar que el archivo se descargó correctamente
                if os.path.exists(temp_file) and os.path.getsize(temp_file) > 0:
                    logger.info(
                        f"Successfully downloaded video: {temp_file} ({os.path.getsize(temp_file)} bytes)"
                    )
                    return temp_file
                else:
                    logger.error(
                        f"Downloaded file is empty or doesn't exist: {temp_file}"
                    )
                    return None
            else:
                logger.error(
                    f"Failed to download video from S3: {download_result.get('error')}"
                )
                return None

        except Exception as e:
            logger.error(f"Error downloading video from S3: {str(e)}")
            return None

    def _check_ffmpeg_available(self) -> bool:
        """Verifica si FFmpeg está disponible en el sistema"""
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"], capture_output=True, timeout=10
            )
            return result.returncode == 0
        except (FileNotFoundError, subprocess.TimeoutExpired):
            return False

    def _merge_videos_with_ffmpeg_python(self, video_files: List[Dict]) -> str:
        """Une videos usando ffmpeg-python (alternativa más robusta)"""
        if not FFMPEG_PYTHON_AVAILABLE:
            logger.warning("ffmpeg-python not available, falling back to subprocess")
            return None

        try:
            if len(video_files) == 1:
                logger.info("Only one video file, skipping merge")
                return video_files[0]["file"]

            # Archivo de salida
            output_file = os.path.join(
                self.temp_dir,
                f"merged_video_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm",
            )

            logger.info(
                f"Starting ffmpeg-python video merge with {len(video_files)} files"
            )

            # Crear inputs
            inputs = []
            for video_info in video_files:
                input_stream = ffmpeg.input(video_info["file"])
                inputs.append(input_stream)

            # Concatenar videos
            joined = ffmpeg.concat(*inputs, v=1, a=1)

            # Output con configuración optimizada
            out = ffmpeg.output(joined, output_file, vcodec="copy", acodec="copy")

            # Ejecutar con overwrite habilitado
            ffmpeg.run(out, overwrite_output=True, quiet=True)

            # Verificar resultado
            if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                logger.info(
                    f"Successfully merged {len(video_files)} videos using ffmpeg-python: {output_file} ({os.path.getsize(output_file)} bytes)"
                )
                return output_file
            else:
                logger.error(
                    "ffmpeg-python completed but output file is empty or doesn't exist"
                )
                return None

        except Exception as e:
            logger.error(f"Error merging videos with ffmpeg-python: {str(e)}")
            return None

    def _merge_videos_with_ffmpeg(self, video_files: List[Dict]) -> str:
        """Une videos usando FFmpeg"""
        try:
            # Verificar que FFmpeg esté disponible
            if not self._check_ffmpeg_available():
                logger.error(
                    "FFmpeg not found. Please install FFmpeg and add it to system PATH"
                )
                logger.error("Download from: https://ffmpeg.org/download.html")
                return None

            if len(video_files) == 1:
                # Solo un video, no necesita unión
                logger.info("Only one video file, skipping merge")
                return video_files[0]["file"]

            # Crear lista de archivos para FFmpeg
            list_file = os.path.join(self.temp_dir, "video_list.txt")
            with open(list_file, "w", encoding="utf-8") as f:
                for video_info in video_files:
                    # Escapar caracteres especiales en las rutas
                    safe_path = (
                        video_info["file"].replace("\\", "\\\\").replace("'", "\\'")
                    )
                    f.write(f"file '{safe_path}'\n")

            # Archivo de salida
            output_file = os.path.join(
                self.temp_dir,
                f"merged_video_{datetime.now().strftime('%Y%m%d_%H%M%S')}.webm",
            )

            # Comando FFmpeg para unir videos
            cmd = [
                "ffmpeg",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                list_file,
                "-c",
                "copy",  # Copia sin recodificar para mejor rendimiento
                "-y",  # Sobrescribir archivo de salida si existe
                "-loglevel",
                "error",  # Solo mostrar errores
                output_file,
            ]

            logger.info(f"Starting FFmpeg video merge with {len(video_files)} files")
            logger.info(f"FFmpeg command: {' '.join(cmd[:8])}... (truncated)")

            # Ejecutar FFmpeg con timeout más largo para videos grandes
            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=600
            )  # 10 min timeout

            if result.returncode == 0:
                # Verificar que el archivo de salida se creó correctamente
                if os.path.exists(output_file) and os.path.getsize(output_file) > 0:
                    logger.info(
                        f"Successfully merged {len(video_files)} videos: {output_file} ({os.path.getsize(output_file)} bytes)"
                    )
                    return output_file
                else:
                    logger.error(
                        "FFmpeg completed but output file is empty or doesn't exist"
                    )
                    return None
            else:
                logger.error(f"FFmpeg failed with return code {result.returncode}")
                if result.stderr:
                    logger.error(f"FFmpeg error output: {result.stderr}")
                if result.stdout:
                    logger.info(f"FFmpeg stdout: {result.stdout}")
                return None

        except subprocess.TimeoutExpired:
            logger.error("FFmpeg timeout during video merge (600 seconds)")
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

    def _upload_merged_video_to_s3(
        self, video_path: str, participant_event_id: int
    ) -> Dict[str, Any]:
        """Sube el video unido a S3"""
        try:
            with open(video_path, "rb") as video_file:
                # Usar el servicio S3 existente para subir el video completo
                upload_result = s3_service.upload_media_fragment(
                    video_file,
                    participant_event_id,
                    media_type="merged_video",
                    timestamp=datetime.now(),
                )

                if upload_result["success"]:
                    # Generar URL pública permanente para el video
                    public_url = s3_service.generate_public_url(upload_result["key"])
                    if public_url:
                        return {
                            "success": True,
                            "video_url": public_url,
                            "s3_key": upload_result["key"],
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
            # Intentar remover el directorio temporal
            os.rmdir(self.temp_dir)
        except Exception as e:
            logger.warning(f"Could not remove temp directory {self.temp_dir}: {str(e)}")


# Instancia global del servicio
video_merger_service = VideoMergerService()
