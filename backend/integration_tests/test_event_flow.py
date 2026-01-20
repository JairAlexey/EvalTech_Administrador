import json
from datetime import timedelta
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser, UserRole
from authentication.utils import generate_token
from behavior_analysis.models import AnalisisComportamiento
from events.models import Participant, ParticipantEvent, ParticipantLog


class EventLifecycleIntegrationTests(TestCase):
    def setUp(self):
        self.admin = CustomUser.objects.create(
            email="admin.integration@example.com",
            first_name="Admin",
            last_name="Integration",
            password="hashed",
        )
        UserRole.objects.create(user=self.admin, role="admin")

        self.evaluator = CustomUser.objects.create(
            email="evaluator.integration@example.com",
            first_name="Eval",
            last_name="Integration",
            password="hashed",
        )
        UserRole.objects.create(user=self.evaluator, role="evaluator")

        self.participants = [
            Participant.objects.create(
                first_name="Ana",
                last_name="One",
                name="Ana One",
                email="ana.one@example.com",
            ),
            Participant.objects.create(
                first_name="Luis",
                last_name="Two",
                name="Luis Two",
                email="luis.two@example.com",
            ),
        ]

        self.auth_headers = self._auth_headers_for(self.admin)
        self.evaluator_headers = self._auth_headers_for(self.evaluator)

    def _auth_headers_for(self, user):
        token = generate_token(user)
        if isinstance(token, bytes):
            token = token.decode("utf-8")
        return {"HTTP_AUTHORIZATION": f"Bearer {token}"}

    def _event_key_headers(self, participant_event):
        return {"HTTP_AUTHORIZATION": f"Bearer {participant_event.event_key}"}

    def _create_event(self, name, participants=None, blocked_website_ids=None):
        start_dt = timezone.now() + timedelta(days=1)
        start_dt = start_dt.replace(second=0, microsecond=0)
        close_dt = start_dt + timedelta(minutes=10)

        payload = {
            "eventName": name,
            "description": "Integration flow for event lifecycle",
            "startDate": start_dt.strftime("%Y-%m-%d"),
            "startTime": start_dt.strftime("%H:%M"),
            "closeTime": close_dt.strftime("%H:%M"),
            "evaluator": self.evaluator.id,
            "duration": 30,
            "timezone": "UTC",
            "participants": [
                {"id": participant.id, "selected": True}
                for participant in (participants or self.participants)
            ],
            "blockedWebsites": blocked_website_ids or [],
        }

        response = self.client.post(
            "/events/api/events",
            data=json.dumps(payload),
            content_type="application/json",
            **self.auth_headers,
        )
        self.assertEqual(response.status_code, 200, response.content)
        data = json.loads(response.content.decode("utf-8"))
        self.assertTrue(data.get("success"))
        return data["id"]

    def _activate_event(self, event):
        now = timezone.now()
        event.start_date = now - timedelta(minutes=1)
        event.close_date = now + timedelta(minutes=10)
        event.end_date = now + timedelta(minutes=40)
        event.status = "en_progreso"
        event.save()

    def test_event_lifecycle_to_analysis_report(self):
        event_id = self._create_event("Integration Event Flow")

        response = self.client.post(f"/events/api/events-status/{event_id}/start/")
        self.assertEqual(response.status_code, 200)

        response = self.client.post(f"/events/api/events-status/{event_id}/finish/")
        self.assertEqual(response.status_code, 200)

        participant_events = list(
            ParticipantEvent.objects.filter(event_id=event_id).select_related(
                "participant"
            )
        )
        self.assertEqual(len(participant_events), len(self.participants))

        for participant_event in participant_events:
            ParticipantLog.objects.create(
                name="audio/video",
                message="Media",
                url="media/video.webm",
                participant_event=participant_event,
            )
            ParticipantLog.objects.create(
                name="screen",
                message="Screen",
                url="media/screen.jpg",
                participant_event=participant_event,
            )
            AnalisisComportamiento.objects.create(
                participant_event=participant_event,
                video_link="media/merged.mp4",
                status="completado",
            )

        task_results = [
            mock.Mock(id=f"task-{index}")
            for index in range(1, len(participant_events) + 1)
        ]
        with mock.patch(
            "behavior_analysis.tasks.process_participant_completion_task.delay",
            side_effect=task_results,
        ):
            response = self.client.post(
                "/analysis/process-event-completion/",
                data=json.dumps({"event_id": event_id}),
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 202)
        completion_payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(
            completion_payload["total_participants"], len(participant_events)
        )
        self.assertEqual(len(completion_payload["skipped_participants"]), 0)
        self.assertEqual(len(completion_payload["task_ids"]), len(participant_events))

        for participant_event in participant_events:
            response = self.client.get(
                f"/analysis/status/{event_id}/participants/{participant_event.participant.id}/",
                **self.auth_headers,
            )
            self.assertEqual(response.status_code, 200)
            status_payload = json.loads(response.content.decode("utf-8"))
            self.assertEqual(
                status_payload["participant"]["id"],
                participant_event.participant.id,
            )
            self.assertEqual(status_payload["analysis"]["status"], "completado")

            response = self.client.get(
                f"/analysis/report/{event_id}/participants/{participant_event.participant.id}/",
                **self.auth_headers,
            )
            self.assertEqual(response.status_code, 200)
            report_payload = json.loads(response.content.decode("utf-8"))
            self.assertEqual(report_payload["analysis"]["status"], "completado")
            self.assertEqual(report_payload["statistics"]["total_videos"], 1)
            self.assertEqual(report_payload["statistics"]["total_screenshots"], 1)

    def test_event_access_and_logging_flow(self):
        participant = self.participants[0]
        event_id = self._create_event(
            "Integration Access Flow", participants=[participant]
        )

        participant_event = ParticipantEvent.objects.get(
            event_id=event_id, participant=participant
        )
        self._activate_event(participant_event.event)

        now = timezone.now()
        participant_event.is_monitoring = True
        participant_event.monitoring_current_session_time = now
        participant_event.monitoring_last_change = now
        participant_event.monitoring_sessions_count = 1
        participant_event.save()

        response = self.client.get(
            "/events/api/verify-event-key",
            **self._event_key_headers(participant_event),
        )
        self.assertEqual(response.status_code, 200)
        access_payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(access_payload["isValid"])

        response = self.client.post(
            "/events/api/logging/http-request",
            data=json.dumps({"type": "http", "uri": "https://blocked.example.com"}),
            content_type="application/json",
            **self._event_key_headers(participant_event),
        )
        self.assertEqual(response.status_code, 200)

        upload_results = [
            {"success": True, "key": "media/screen.png", "presigned_url": "signed"},
            {"success": True, "key": "media/video.webm", "presigned_url": "signed"},
        ]
        with mock.patch(
            "events.views.s3_service.upload_media_fragment",
            side_effect=upload_results,
        ):
            screen_file = SimpleUploadedFile(
                "screen.png", b"screen", content_type="image/png"
            )
            response = self.client.post(
                "/events/api/logging/screen/capture",
                data={"screenshot": screen_file, "monitor_name": "Monitor 1"},
                **self._event_key_headers(participant_event),
            )
            self.assertEqual(response.status_code, 200)

            video_file = SimpleUploadedFile(
                "clip.webm", b"video", content_type="video/webm"
            )
            response = self.client.post(
                "/events/api/logging/media/capture",
                data={"media": video_file},
                **self._event_key_headers(participant_event),
            )
            self.assertEqual(response.status_code, 200)

        with mock.patch("events.views.s3_service.is_configured", return_value=False):
            response = self.client.get(
                f"/events/api/events/{event_id}/participants/{participant.id}/logs/",
                **self.auth_headers,
            )
        self.assertEqual(response.status_code, 200)
        logs_payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(logs_payload["event"]["id"], event_id)
        self.assertGreaterEqual(logs_payload["total"], 3)
        log_names = {log["name"] for log in logs_payload["logs"]}
        self.assertIn("http", log_names)
        self.assertIn("screen", log_names)
        self.assertIn("audio/video", log_names)

        response = self.client.get(
            f"/events/api/events/{event_id}/participants/{participant.id}/connection-stats/",
            **self.auth_headers,
        )
        self.assertEqual(response.status_code, 200)
        stats_payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(stats_payload["monitoring_is_active"])
        self.assertEqual(stats_payload["monitoring_sessions_count"], 1)

    def test_block_unblock_participant_flow(self):
        participant = self.participants[0]
        event_id = self._create_event(
            "Integration Block Flow", participants=[participant]
        )

        participant_event = ParticipantEvent.objects.get(
            event_id=event_id, participant=participant
        )
        self._activate_event(participant_event.event)

        response = self.client.get(
            "/events/api/verify-event-key",
            **self._event_key_headers(participant_event),
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.post(
            f"/events/api/events/{event_id}/participants/block",
            data=json.dumps({"participant_ids": [participant.id]}),
            content_type="application/json",
            **self.auth_headers,
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.get(
            "/events/api/verify-event-key",
            **self._event_key_headers(participant_event),
        )
        self.assertEqual(response.status_code, 403)
        blocked_payload = json.loads(response.content.decode("utf-8"))
        self.assertFalse(blocked_payload["isValid"])
        self.assertTrue(blocked_payload["specificError"])

        response = self.client.post(
            f"/events/api/events/{event_id}/participants/unblock",
            data=json.dumps({"participant_ids": [participant.id]}),
            content_type="application/json",
            **self.auth_headers,
        )
        self.assertEqual(response.status_code, 200)

        response = self.client.get(
            "/events/api/verify-event-key",
            **self._event_key_headers(participant_event),
        )
        self.assertEqual(response.status_code, 200)
        unblocked_payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(unblocked_payload["isValid"])

    def test_blocked_hosts_and_evaluations_flow(self):
        response = self.client.post(
            "/events/api/websites/",
            data=json.dumps({"hostname": "example.com"}),
            content_type="application/json",
            **self.auth_headers,
        )
        self.assertEqual(response.status_code, 200)
        website_payload = json.loads(response.content.decode("utf-8"))
        website_id = website_payload["id"]

        participant = self.participants[0]
        event_id = self._create_event(
            "Integration Website Flow",
            participants=[participant],
            blocked_website_ids=[website_id],
        )

        response = self.client.get(
            f"/events/api/{event_id}/blocked-hosts/",
            **self.auth_headers,
        )
        self.assertEqual(response.status_code, 200)
        blocked_payload = json.loads(response.content.decode("utf-8"))
        self.assertIn(str(website_id), blocked_payload["blocked_website_ids"])

        response = self.client.get(
            f"/events/api/events/{event_id}",
            **self.auth_headers,
        )
        self.assertEqual(response.status_code, 200)
        detail_payload = json.loads(response.content.decode("utf-8"))
        self.assertIn("example.com", detail_payload["event"]["blockedWebsites"])

        response = self.client.post(f"/events/api/events-status/{event_id}/start/")
        self.assertEqual(response.status_code, 200)
        response = self.client.post(f"/events/api/events-status/{event_id}/finish/")
        self.assertEqual(response.status_code, 200)

        response = self.client.get("/events/api/evaluations", **self.auth_headers)
        self.assertEqual(response.status_code, 200)
        evaluations_payload = json.loads(response.content.decode("utf-8"))
        evaluation_ids = {item["id"] for item in evaluations_payload["evaluaciones"]}
        self.assertIn(event_id, evaluation_ids)

        response = self.client.get(
            f"/events/api/evaluations/{event_id}",
            **self.auth_headers,
        )
        self.assertEqual(response.status_code, 200)
        detail_payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(len(detail_payload["event"]["participants"]), 1)

        response = self.client.get(
            "/events/api/evaluations", **self.evaluator_headers
        )
        self.assertEqual(response.status_code, 200)
        evaluator_payload = json.loads(response.content.decode("utf-8"))
        evaluator_ids = {item["id"] for item in evaluator_payload["evaluaciones"]}
        self.assertIn(event_id, evaluator_ids)
