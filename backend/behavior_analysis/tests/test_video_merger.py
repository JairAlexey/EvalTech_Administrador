import os
import subprocess
import tempfile
from types import SimpleNamespace
from unittest import mock

from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser
from behavior_analysis.video_merger import VideoMergerService
from events.models import Event, Participant, ParticipantEvent, ParticipantLog


class VideoMergerServiceTests(TestCase):
    def setUp(self):
        now = timezone.now()
        evaluator = CustomUser.objects.create(
            email="merge@example.com",
            first_name="Merge",
            last_name="User",
            password="hashed",
        )
        event = Event.objects.create(
            name="Merge Event",
            description="Merge",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=15,
            evaluator=evaluator,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Merge",
            last_name="Participant",
            name="Merge Participant",
            email="mergep@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant
        )

    def test_merge_participant_videos_no_logs(self):
        service = VideoMergerService()
        result = service.merge_participant_videos(self.participant_event.id)
        self.assertFalse(result["success"])
        self.assertTrue(result["skipped"])

    def test_check_ffmpeg_available(self):
        service = VideoMergerService()
        with mock.patch("behavior_analysis.video_merger.subprocess.run") as run_mock:
            run_mock.return_value = SimpleNamespace(returncode=0)
            self.assertTrue(service._check_ffmpeg_available())

    def test_check_ffmpeg_available_failure(self):
        service = VideoMergerService()
        with mock.patch("behavior_analysis.video_merger.subprocess.run") as run_mock:
            run_mock.return_value = SimpleNamespace(returncode=1)
            self.assertFalse(service._check_ffmpeg_available())

    def test_merge_videos_with_ffmpeg_success(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            file1 = os.path.join(temp_dir, "a.webm")
            file2 = os.path.join(temp_dir, "b.webm")
            for path in (file1, file2):
                with open(path, "wb") as handle:
                    handle.write(b"data")

            def run_side_effect(cmd, capture_output=True, text=True, timeout=10):
                output_file = cmd[-1]
                with open(output_file, "wb") as out:
                    out.write(b"merged")
                return SimpleNamespace(returncode=0, stderr="", stdout="")

            with mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run", side_effect=run_side_effect
            ):
                output = service._merge_videos_with_ffmpeg(
                    [{"file": file1}, {"file": file2}]
                )

        self.assertTrue(output)

    def test_merge_videos_with_ffmpeg_no_files(self):
        service = VideoMergerService()
        with mock.patch.object(service, "_check_ffmpeg_available", return_value=True):
            output = service._merge_videos_with_ffmpeg([])
        self.assertIsNone(output)

    def test_merge_videos_with_ffmpeg_missing_ffmpeg(self):
        service = VideoMergerService()
        with mock.patch.object(service, "_check_ffmpeg_available", return_value=False):
            output = service._merge_videos_with_ffmpeg([{"file": "a.webm"}])
        self.assertIsNone(output)

    def test_merge_videos_with_ffmpeg_failure(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            file1 = os.path.join(temp_dir, "a.webm")
            with open(file1, "wb") as handle:
                handle.write(b"data")

            with mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run",
                return_value=SimpleNamespace(returncode=1, stderr="boom", stdout=""),
            ):
                output = service._merge_videos_with_ffmpeg([{"file": file1}])

        self.assertIsNone(output)

    def test_download_video_from_s3_failure(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            with mock.patch(
                "behavior_analysis.video_merger.s3_service.download_file",
                return_value={"success": False, "error": "fail"},
            ):
                output = service._download_video_from_s3("media/key.webm")

        self.assertIsNone(output)

    def test_download_video_from_s3_empty_file(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            with mock.patch(
                "behavior_analysis.video_merger.s3_service.download_file",
                return_value={"success": True},
            ), mock.patch(
                "behavior_analysis.video_merger.os.path.exists", return_value=False
            ):
                output = service._download_video_from_s3("media/key.webm")

        self.assertIsNone(output)

    def test_upload_merged_video_to_s3_failure(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            video_path = os.path.join(temp_dir, "merged.mp4")
            with open(video_path, "wb") as handle:
                handle.write(b"data")

            with mock.patch(
                "behavior_analysis.video_merger.s3_service.upload_media_fragment",
                return_value={"success": False, "error": "fail"},
            ):
                result = service._upload_merged_video_to_s3(
                    video_path, self.participant_event.id
                )

        self.assertFalse(result["success"])

    def test_upload_merged_video_to_s3_success(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            video_path = os.path.join(temp_dir, "merged.mp4")
            with open(video_path, "wb") as handle:
                handle.write(b"data")

            with mock.patch(
                "behavior_analysis.video_merger.s3_service.upload_media_fragment",
                return_value={"success": True, "key": "merged.mp4", "presigned_url": "signed"},
            ):
                result = service._upload_merged_video_to_s3(
                    video_path, self.participant_event.id
                )

        self.assertTrue(result["success"])

    def test_sanitize_video_success(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            input_path = os.path.join(temp_dir, "input.mp4")
            with open(input_path, "wb") as handle:
                handle.write(b"data")

            def run_side_effect(cmd, capture_output=True, text=True, timeout=14400):
                output_file = cmd[-1]
                with open(output_file, "wb") as out:
                    out.write(b"clean")
                return SimpleNamespace(returncode=0, stderr="", stdout="")

            with mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run", side_effect=run_side_effect
            ):
                output = service._sanitize_video(input_path)

        self.assertTrue(output)

    def test_sanitize_video_ffmpeg_missing(self):
        service = VideoMergerService()
        with mock.patch.object(service, "_check_ffmpeg_available", return_value=False):
            output = service._sanitize_video("input.mp4")
        self.assertIsNone(output)

    def test_merge_participant_videos_download_failure(self):
        ParticipantLog.objects.create(
            name="audio/video",
            message="Media",
            url="media/key.webm",
            participant_event=self.participant_event,
        )
        service = VideoMergerService()
        with mock.patch.object(
            service, "_download_video_from_s3", return_value=None
        ):
            result = service.merge_participant_videos(self.participant_event.id)

        self.assertFalse(result["success"])

    def test_merge_participant_videos_merge_failure(self):
        ParticipantLog.objects.create(
            name="audio/video",
            message="Media",
            url="media/key.webm",
            participant_event=self.participant_event,
        )
        service = VideoMergerService()
        with mock.patch.object(
            service, "_download_video_from_s3", return_value="video.webm"
        ), mock.patch.object(
            service, "_merge_videos_with_ffmpeg", return_value=None
        ):
            result = service.merge_participant_videos(self.participant_event.id)

        self.assertFalse(result["success"])

    def test_download_video_from_s3_success(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir

            def download_side_effect(key, dest):
                with open(dest, "wb") as handle:
                    handle.write(b"data")
                return {"success": True}

            with mock.patch(
                "behavior_analysis.video_merger.s3_service.download_file",
                side_effect=download_side_effect,
            ):
                output = service._download_video_from_s3("media/key.webm")

        self.assertTrue(output)

    def test_download_video_from_s3_exception(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            with mock.patch(
                "behavior_analysis.video_merger.s3_service.download_file",
                side_effect=RuntimeError("boom"),
            ):
                output = service._download_video_from_s3("media/key.webm")

        self.assertIsNone(output)

    def test_download_video_from_s3_amazonaws(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir

            def download_side_effect(key, dest):
                with open(dest, "wb") as handle:
                    handle.write(b"data")
                return {"success": True}

            with mock.patch(
                "behavior_analysis.video_merger.s3_service.download_file",
                side_effect=download_side_effect,
            ):
                output = service._download_video_from_s3(
                    "https://bucket.s3.amazonaws.com/media/key.webm"
                )

        self.assertTrue(output)

    def test_merge_participant_videos_upload_failure(self):
        ParticipantLog.objects.create(
            name="audio/video",
            message="Media",
            url="media/key.webm",
            participant_event=self.participant_event,
        )
        service = VideoMergerService()
        with mock.patch.object(
            service, "_download_video_from_s3", return_value="video.webm"
        ), mock.patch.object(
            service, "_merge_videos_with_ffmpeg", return_value="merged.mp4"
        ), mock.patch.object(
            service, "_upload_merged_video_to_s3",
            return_value={"success": False, "error": "fail"},
        ):
            result = service.merge_participant_videos(self.participant_event.id)

        self.assertFalse(result["success"])

    def test_merge_participant_videos_exception(self):
        ParticipantLog.objects.create(
            name="audio/video",
            message="Media",
            url="media/key.webm",
            participant_event=self.participant_event,
        )
        service = VideoMergerService()
        with mock.patch.object(
            service, "_download_video_from_s3", side_effect=RuntimeError("boom")
        ):
            result = service.merge_participant_videos(self.participant_event.id)

        self.assertFalse(result["success"])

    def test_check_ffmpeg_available_exception(self):
        service = VideoMergerService()
        with mock.patch(
            "behavior_analysis.video_merger.subprocess.run",
            side_effect=FileNotFoundError(),
        ):
            self.assertFalse(service._check_ffmpeg_available())

    def test_merge_videos_with_ffmpeg_output_missing(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            file1 = os.path.join(temp_dir, "a.webm")
            with open(file1, "wb") as handle:
                handle.write(b"data")

            with mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run",
                return_value=SimpleNamespace(returncode=0, stderr="", stdout=""),
            ), mock.patch(
                "behavior_analysis.video_merger.os.path.exists", return_value=False
            ):
                output = service._merge_videos_with_ffmpeg([{"file": file1}])

        self.assertIsNone(output)

    def test_merge_videos_with_ffmpeg_timeout(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            file1 = os.path.join(temp_dir, "a.webm")
            with open(file1, "wb") as handle:
                handle.write(b"data")

            with mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run",
                side_effect=subprocess.TimeoutExpired(cmd="ffmpeg", timeout=1),
            ):
                output = service._merge_videos_with_ffmpeg([{"file": file1}])

        self.assertIsNone(output)

    def test_merge_videos_with_ffmpeg_failure_with_stdout(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            file1 = os.path.join(temp_dir, "a.webm")
            with open(file1, "wb") as handle:
                handle.write(b"data")

            with mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run",
                return_value=SimpleNamespace(returncode=1, stderr="boom", stdout="out"),
            ):
                output = service._merge_videos_with_ffmpeg([{"file": file1}])

        self.assertIsNone(output)

    def test_merge_videos_with_ffmpeg_filenotfound(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            file1 = os.path.join(temp_dir, "a.webm")
            with open(file1, "wb") as handle:
                handle.write(b"data")

            with mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run",
                side_effect=FileNotFoundError(),
            ):
                output = service._merge_videos_with_ffmpeg([{"file": file1}])

        self.assertIsNone(output)

    def test_sanitize_video_failure(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            input_path = os.path.join(temp_dir, "input.mp4")
            with open(input_path, "wb") as handle:
                handle.write(b"data")

            with mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run",
                return_value=SimpleNamespace(returncode=1, stderr="boom", stdout=""),
            ):
                output = service._sanitize_video(input_path)

        self.assertIsNone(output)

    def test_sanitize_video_timeout_with_threads(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            input_path = os.path.join(temp_dir, "input.mp4")
            with open(input_path, "wb") as handle:
                handle.write(b"data")

            with mock.patch.dict(
                "behavior_analysis.video_merger.os.environ",
                {"FFMPEG_THREADS": "2"},
                clear=False,
            ), mock.patch.object(
                service, "_check_ffmpeg_available", return_value=True
            ), mock.patch(
                "behavior_analysis.video_merger.subprocess.run",
                side_effect=subprocess.TimeoutExpired(cmd="ffmpeg", timeout=1),
            ):
                output = service._sanitize_video(input_path)

        self.assertIsNone(output)

    def test_cleanup_temp_files_errors(self):
        service = VideoMergerService()
        with tempfile.TemporaryDirectory() as temp_dir:
            service.temp_dir = temp_dir
            file_path = os.path.join(temp_dir, "temp.webm")
            with open(file_path, "wb") as handle:
                handle.write(b"data")

            with mock.patch(
                "behavior_analysis.video_merger.os.remove",
                side_effect=OSError("boom"),
            ), mock.patch(
                "behavior_analysis.video_merger.os.rmdir",
                side_effect=OSError("boom"),
            ):
                service._cleanup_temp_files([{"file": file_path}])

    def test_merge_participant_videos_rmdir_failure(self):
        service = VideoMergerService()
        with mock.patch(
            "behavior_analysis.video_merger.os.rmdir", side_effect=OSError("boom")
        ):
            result = service.merge_participant_videos(self.participant_event.id)

        self.assertFalse(result["success"])
    def test_merge_participant_videos_success(self):
        ParticipantLog.objects.create(
            name="audio/video",
            message="Media",
            url="media/key.webm",
            participant_event=self.participant_event,
        )
        service = VideoMergerService()

        with tempfile.TemporaryDirectory() as temp_dir:
            def download_side_effect(url):
                file_path = os.path.join(temp_dir, "video.webm")
                with open(file_path, "wb") as handle:
                    handle.write(b"data")
                return file_path

            merged_path = os.path.join(temp_dir, "merged.mp4")
            with open(merged_path, "wb") as handle:
                handle.write(b"merged")

            with mock.patch.object(
                service, "_download_video_from_s3", side_effect=download_side_effect
            ), mock.patch.object(
                service, "_merge_videos_with_ffmpeg", return_value=merged_path
            ), mock.patch.object(
                service, "_upload_merged_video_to_s3",
                return_value={"success": True, "s3_key": "merged.mp4", "presigned_url": "signed"},
            ):
                result = service.merge_participant_videos(self.participant_event.id)

        self.assertTrue(result["success"])
