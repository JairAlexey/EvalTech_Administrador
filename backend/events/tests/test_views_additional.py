import json
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.test import RequestFactory, TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events import views
from events.models import Event, EventConsent, Participant, ParticipantEvent, ParticipantLog


class EventsViewsAdditionalTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.admin = CustomUser.objects.create(
            email="extra-admin@example.com",
            first_name="Extra",
            last_name="Admin",
            password="hashed",
        )

    def _create_event_and_participant(self, is_monitoring=False):
        now = timezone.now()
        event = Event.objects.create(
            name="Extra Event",
            description="Extra",
            start_date=now - timedelta(minutes=1),
            close_date=now + timedelta(minutes=5),
            end_date=now + timedelta(minutes=10),
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Extra",
            last_name="Participant",
            name="Extra Participant",
            email=f"extra-{Participant.objects.count()}@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant, is_monitoring=is_monitoring
        )
        return event, participant, participant_event

    def test_validate_participant_fields_errors_and_conflicts(self):
        Participant.objects.create(
            first_name="Existing",
            last_name="User",
            name="Existing User",
            email="existing@example.com",
        )

        seen = set()
        _, _, _, errors = views._validate_participant_fields("", "", "bad", seen)
        self.assertIn("Nombre requerido", errors)
        self.assertIn("Apellidos requeridos", errors)
        self.assertTrue(any(error.startswith("Email") for error in errors))

        seen = {"dup@example.com"}
        _, _, _, errors = views._validate_participant_fields(
            "Dup", "User", "dup@example.com", seen
        )
        self.assertIn("Email duplicado en el archivo", errors)

        seen = set()
        _, _, _, errors = views._validate_participant_fields(
            "New", "User", "existing@example.com", seen
        )
        self.assertIn("Email ya existe en el sistema", errors)

    def test_validate_participant_fields_conflicts_in_excel_allowed(self):
        Participant.objects.create(
            first_name="Conflict",
            last_name="User",
            name="Conflict User",
            email="conflict@example.com",
        )
        seen = set()
        _, _, _, errors = views._validate_participant_fields(
            "New",
            "User",
            "conflict@example.com",
            seen,
            ids_in_excel={999},
        )
        self.assertNotIn("Email ya existe en el sistema", errors)

    def test_allow_upload_after_block_grace_period(self):
        now = timezone.now()
        self.assertTrue(views._allow_upload_after_block(SimpleNamespace(is_monitoring=True), now))
        self.assertFalse(
            views._allow_upload_after_block(
                SimpleNamespace(is_monitoring=False, is_blocked=False), now
            )
        )
        self.assertTrue(
            views._allow_upload_after_block(
                SimpleNamespace(
                    is_monitoring=False,
                    is_blocked=True,
                    monitoring_sessions_count=1,
                    monitoring_last_change=now - timedelta(seconds=30),
                ),
                now,
            )
        )

    def test_presign_participant_screen_upload_success(self):
        _, _, participant_event = self._create_event_and_participant(is_monitoring=True)
        request = self.factory.post(
            "/events/api/logging/screen/presign",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        presign_payload = {
            "success": True,
            "key": "media/key",
            "upload_url": "https://signed",
            "headers": {"Content-Type": "image/jpeg"},
        }
        with mock.patch(
            "events.views.s3_service.generate_presigned_upload",
            return_value=presign_payload,
        ):
            response = views.presign_participant_screen_upload(request)

        self.assertEqual(response.status_code, 200)

    def test_presign_participant_screen_upload_not_monitoring(self):
        _, _, participant_event = self._create_event_and_participant(is_monitoring=False)
        request = self.factory.post(
            "/events/api/logging/screen/presign",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        response = views.presign_participant_screen_upload(request)
        self.assertEqual(response.status_code, 403)

    def test_presign_participant_screen_upload_failed_presign(self):
        _, _, participant_event = self._create_event_and_participant(is_monitoring=True)
        request = self.factory.post(
            "/events/api/logging/screen/presign",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        with mock.patch(
            "events.views.s3_service.generate_presigned_upload",
            return_value={"success": False, "error": "boom"},
        ):
            response = views.presign_participant_screen_upload(request)
        self.assertEqual(response.status_code, 500)

    def test_presign_participant_media_upload_audio(self):
        _, _, participant_event = self._create_event_and_participant(is_monitoring=True)
        request = self.factory.post(
            "/events/api/logging/media/presign",
            data=json.dumps({"media_type": "audio"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        presign_payload = {
            "success": True,
            "key": "media/key",
            "upload_url": "https://signed",
            "headers": {"Content-Type": "audio/webm"},
        }
        with mock.patch(
            "events.views.s3_service.generate_presigned_upload",
            return_value=presign_payload,
        ) as presign_mock:
            response = views.presign_participant_media_upload(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(presign_mock.call_args.kwargs["media_type"], "audio")

    def test_log_participant_screen_event_s3_key_body(self):
        _, _, participant_event = self._create_event_and_participant(is_monitoring=True)
        request = self.factory.post(
            "/events/api/logging/screen/capture",
            data=json.dumps({"s3_key": "media/screen", "monitor_name": "Monitor A"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        with mock.patch(
            "events.views.s3_service.generate_presigned_url", return_value="signed"
        ):
            response = views.log_participant_screen_event(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            ParticipantLog.objects.filter(
                participant_event=participant_event, url="media/screen"
            ).exists()
        )

    def test_log_participant_screen_event_missing_s3_key(self):
        _, _, participant_event = self._create_event_and_participant(is_monitoring=True)
        request = self.factory.post(
            "/events/api/logging/screen/capture",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        response = views.log_participant_screen_event(request)
        self.assertEqual(response.status_code, 400)

    def test_log_participant_audio_video_event_s3_key_body(self):
        _, _, participant_event = self._create_event_and_participant(is_monitoring=True)
        request = self.factory.post(
            "/events/api/logging/media/capture",
            data=json.dumps({"s3_key": "media/video"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        with mock.patch(
            "events.views.s3_service.generate_presigned_url", return_value="signed"
        ):
            response = views.log_participant_audio_video_event(request)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            ParticipantLog.objects.filter(
                participant_event=participant_event, url="media/video"
            ).exists()
        )

    def test_log_participant_audio_video_event_missing_s3_key(self):
        _, _, participant_event = self._create_event_and_participant(is_monitoring=True)
        request = self.factory.post(
            "/events/api/logging/media/capture",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        response = views.log_participant_audio_video_event(request)
        self.assertEqual(response.status_code, 400)

    def test_verify_event_key_with_consent(self):
        event, participant, participant_event = self._create_event_and_participant(
            is_monitoring=True
        )
        participant_event.monitoring_total_duration = 15
        participant_event.save()
        EventConsent.objects.create(
            participant=participant,
            event=event,
            consent_version="v1",
        )

        request = self.factory.get(
            "/events/api/verify-event-key",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        response = views.verify_event_key(request)
        payload = json.loads(response.content.decode("utf-8"))

        self.assertTrue(payload["isValid"])
        self.assertFalse(payload["consentRequired"])
        self.assertIn("connectionInfo", payload)
