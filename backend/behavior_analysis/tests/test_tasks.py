from types import SimpleNamespace
from unittest import mock

from django.test import TestCase
from django.utils import timezone

from celery.app.task import Task
from authentication.models import CustomUser
from behavior_analysis import tasks
from events.models import Event, Participant, ParticipantEvent


class BehaviorAnalysisTasksTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.evaluator = CustomUser.objects.create(
            email="task@example.com",
            first_name="Task",
            last_name="User",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Task Event",
            description="Task",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=15,
            evaluator=self.evaluator,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Task",
            last_name="Participant",
            name="Task Participant",
            email="taskp@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=participant
        )

    def test_process_participant_completion_task_skip(self):
        with mock.patch.object(
            Task,
            "request",
            new_callable=mock.PropertyMock,
            return_value=SimpleNamespace(id="req-1"),
        ), mock.patch(
            "behavior_analysis.tasks.video_merger_service.merge_participant_videos",
            return_value={"success": False, "skipped": True, "error": "no_video"},
        ):
            result = tasks.process_participant_completion_task.run(
                self.participant_event.id, self.event.id, self.event.name
            )

        self.assertFalse(result["success"])
        self.assertTrue(result["skipped"])

    def test_process_participant_completion_task_success(self):
        with mock.patch.object(
            Task,
            "request",
            new_callable=mock.PropertyMock,
            return_value=SimpleNamespace(id="req-2"),
        ), mock.patch(
            "behavior_analysis.tasks.video_merger_service.merge_participant_videos",
            return_value={
                "success": True,
                "merged_count": 1,
                "s3_key": "media/merged.mp4",
                "video_url": "signed",
            },
        ), mock.patch(
            "behavior_analysis.tasks.AnalisisComportamiento.objects.update_or_create",
            return_value=(mock.Mock(id=1), True),
        ), mock.patch(
            "behavior_analysis.tasks.analyze_behavior_task.delay",
            return_value=mock.Mock(id="analysis-1"),
        ):
            result = tasks.process_participant_completion_task.run(
                self.participant_event.id, self.event.id, self.event.name
            )

        self.assertTrue(result["success"])
        self.assertEqual(result["analysis_task_id"], "analysis-1")

    def test_analyze_behavior_task_skips_when_missing_analysis(self):
        result = tasks.analyze_behavior_task("media/key", 9999)
        self.assertFalse(result["success"])
        self.assertTrue(result["skipped"])

    def test_process_participant_completion_task_missing_participant_event(self):
        with mock.patch.object(
            Task,
            "request",
            new_callable=mock.PropertyMock,
            return_value=SimpleNamespace(id="req-missing"),
        ):
            result = tasks.process_participant_completion_task.run(
                9999, self.event.id, self.event.name
            )

        self.assertFalse(result["success"])
        self.assertIn("not found", result["error"])

    def test_process_participant_completion_task_merge_failed(self):
        with mock.patch.object(
            Task,
            "request",
            new_callable=mock.PropertyMock,
            return_value=SimpleNamespace(id="req-fail"),
        ), mock.patch(
            "behavior_analysis.tasks.video_merger_service.merge_participant_videos",
            return_value={"success": False, "error": "boom"},
        ):
            result = tasks.process_participant_completion_task.run(
                self.participant_event.id, self.event.id, self.event.name
            )

        self.assertFalse(result["success"])
        self.assertIn("Video merge failed", result["error"])

    def test_process_participant_completion_task_missing_video_key(self):
        with mock.patch.object(
            Task,
            "request",
            new_callable=mock.PropertyMock,
            return_value=SimpleNamespace(id="req-nokey"),
        ), mock.patch(
            "behavior_analysis.tasks.video_merger_service.merge_participant_videos",
            return_value={"success": True, "merged_count": 1},
        ):
            result = tasks.process_participant_completion_task.run(
                self.participant_event.id, self.event.id, self.event.name
            )

        self.assertFalse(result["success"])
        self.assertIn("S3 key", result["error"])

    def test_process_participant_completion_task_exception(self):
        with mock.patch.object(
            Task,
            "request",
            new_callable=mock.PropertyMock,
            return_value=SimpleNamespace(id="req-exc"),
        ), mock.patch(
            "behavior_analysis.tasks.video_merger_service.merge_participant_videos",
            side_effect=RuntimeError("boom"),
        ):
            result = tasks.process_participant_completion_task.run(
                self.participant_event.id, self.event.id, self.event.name
            )

        self.assertFalse(result["success"])
        self.assertIn("Unexpected error", result["error"])
