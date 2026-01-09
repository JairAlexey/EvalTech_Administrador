import json
from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase
from django.utils import timezone

from authentication.models import CustomUser, UserRole
from authentication.utils import generate_token
from events import views
from events.models import Event, Participant, ParticipantEvent


class EventsViewsErrorTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.admin = CustomUser.objects.create(
            email="admin-errors@example.com",
            first_name="Admin",
            last_name="Errors",
            password="hashed",
        )
        UserRole.objects.create(user=self.admin, role="admin")
        self.token = generate_token(self.admin)

    def _auth_headers(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def test_verify_event_key_missing_header(self):
        request = self.factory.get("/events/api/verify-event-key")
        response = views.verify_event_key(request)
        self.assertEqual(response.status_code, 401)

    def test_verify_event_key_blocked_participant(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Blocked Event",
            description="Blocked",
            start_date=now - timedelta(minutes=5),
            close_date=now + timedelta(minutes=5),
            end_date=now + timedelta(minutes=10),
            duration=15,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Blocked",
            last_name="User",
            name="Blocked User",
            email="blocked@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant, is_blocked=True
        )

        request = self.factory.get(
            "/events/api/verify-event-key",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        response = views.verify_event_key(request)
        self.assertEqual(response.status_code, 403)

    def test_events_post_missing_fields(self):
        request = self.factory.post(
            "/events/api/events",
            data=json.dumps({"description": "Missing name"}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.events(request)
        self.assertEqual(response.status_code, 400)

    def test_events_post_invalid_duration(self):
        now = timezone.now() + timedelta(days=1)
        request = self.factory.post(
            "/events/api/events",
            data=json.dumps(
                {
                    "eventName": "Event Invalid Duration",
                    "description": "Valid description",
                    "startDate": now.strftime("%Y-%m-%d"),
                    "startTime": now.strftime("%H:%M"),
                    "closeTime": (now + timedelta(minutes=10)).strftime("%H:%M"),
                    "evaluator": self.admin.id,
                    "duration": "bad",
                    "timezone": "UTC",
                    "participants": [],
                }
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.events(request)
        self.assertEqual(response.status_code, 400)

    def test_events_post_invalid_time_format(self):
        request = self.factory.post(
            "/events/api/events",
            data=json.dumps(
                {
                    "eventName": "Event Invalid Time",
                    "description": "Valid description",
                    "startDate": "2025-01-01",
                    "startTime": "bad",
                    "closeTime": "bad",
                    "evaluator": self.admin.id,
                    "duration": 30,
                    "timezone": "UTC",
                    "participants": [],
                }
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.events(request)
        self.assertEqual(response.status_code, 400)

    def test_events_post_start_in_past(self):
        now = timezone.now() - timedelta(minutes=1)
        request = self.factory.post(
            "/events/api/events",
            data=json.dumps(
                {
                    "eventName": "Event Past",
                    "description": "Valid description",
                    "startDate": now.strftime("%Y-%m-%d"),
                    "startTime": now.strftime("%H:%M"),
                    "closeTime": (now + timedelta(minutes=10)).strftime("%H:%M"),
                    "evaluator": self.admin.id,
                    "duration": 30,
                    "timezone": "UTC",
                    "participants": [],
                }
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.events(request)
        self.assertEqual(response.status_code, 400)

    def test_events_post_close_time_too_early(self):
        now = timezone.now() + timedelta(days=1)
        request = self.factory.post(
            "/events/api/events",
            data=json.dumps(
                {
                    "eventName": "Event Close Early",
                    "description": "Valid description",
                    "startDate": now.strftime("%Y-%m-%d"),
                    "startTime": now.strftime("%H:%M"),
                    "closeTime": (now + timedelta(minutes=1)).strftime("%H:%M"),
                    "evaluator": self.admin.id,
                    "duration": 30,
                    "timezone": "UTC",
                    "participants": [],
                }
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.events(request)
        self.assertEqual(response.status_code, 400)

    def test_events_post_overlapping_evaluator(self):
        now = timezone.now() + timedelta(days=1)
        Event.objects.create(
            name="Overlap",
            description="Overlap",
            start_date=now,
            close_date=now + timedelta(minutes=10),
            end_date=now + timedelta(minutes=40),
            duration=30,
            evaluator=self.admin,
            status="programado",
        )

        request = self.factory.post(
            "/events/api/events",
            data=json.dumps(
                {
                    "eventName": "Event Overlap",
                    "description": "Valid description",
                    "startDate": now.strftime("%Y-%m-%d"),
                    "startTime": now.strftime("%H:%M"),
                    "closeTime": (now + timedelta(minutes=10)).strftime("%H:%M"),
                    "evaluator": self.admin.id,
                    "duration": 30,
                    "timezone": "UTC",
                    "participants": [],
                }
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.events(request)
        self.assertEqual(response.status_code, 400)

    def test_event_detail_put_in_progress_start_changed(self):
        now = timezone.now() + timedelta(days=1)
        event = Event.objects.create(
            name="Progress Event",
            description="Progress",
            start_date=now,
            close_date=now + timedelta(minutes=10),
            end_date=now + timedelta(minutes=40),
            duration=30,
            evaluator=self.admin,
            status="en_progreso",
        )

        request = self.factory.put(
            f"/events/api/events/{event.id}",
            data=json.dumps(
                {
                    "eventName": "Progress Event",
                    "description": "Progress",
                    "startDate": (now + timedelta(days=1)).strftime("%Y-%m-%d"),
                    "startTime": now.strftime("%H:%M"),
                    "closeTime": (now + timedelta(minutes=10)).strftime("%H:%M"),
                    "duration": 30,
                    "timezone": "UTC",
                    "evaluator": self.admin.id,
                    "participants": [],
                }
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.event_detail(request, event.id)
        self.assertEqual(response.status_code, 400)

    def test_participants_post_invalid_email(self):
        request = self.factory.post(
            "/events/api/participants",
            data=json.dumps(
                {"first_name": "Ana", "last_name": "User", "email": "bad"}
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.participants(request)
        self.assertEqual(response.status_code, 400)

    def test_import_participants_invalid_file_type(self):
        upload = SimpleUploadedFile(
            "participants.txt", b"data", content_type="text/plain"
        )
        request = self.factory.post(
            "/events/api/participants/import",
            data={"file": upload},
            **self._auth_headers(),
        )
        response = views.import_participants(request)
        self.assertEqual(response.status_code, 400)

    def test_participant_media_files_s3_not_configured(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Media Event",
            description="Media",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Media",
            last_name="User",
            name="Media User",
            email="media2@example.com",
        )
        ParticipantEvent.objects.create(event=event, participant=participant)

        request = self.factory.get(
            f"/events/api/events/{event.id}/participants/{participant.id}/media/",
            **self._auth_headers(),
        )
        with mock.patch(
            "events.views.s3_service.is_configured", return_value=False
        ):
            response = views.participant_media_files(request, event.id, participant.id)

        self.assertEqual(response.status_code, 503)

    def test_create_s3_bucket_not_configured(self):
        request = self.factory.post("/events/api/s3/bucket/create/", **self._auth_headers())

        with mock.patch(
            "events.views.get_user_data", return_value={"role": "admin"}
        ), mock.patch(
            "events.views.s3_service.is_configured", return_value=False
        ), mock.patch.object(
            views.UserRole, "ADMIN", new=SimpleNamespace(value="admin"), create=True
        ):
            response = views.create_s3_bucket(request)

        self.assertEqual(response.status_code, 503)

    def test_block_unblock_participants_missing_ids(self):
        event = Event.objects.create(
            name="Block Event",
            description="Block",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="programado",
        )

        request = self.factory.post(
            f"/events/api/events/{event.id}/participants/block",
            data=json.dumps({}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.block_participants(request, event.id)
        self.assertEqual(response.status_code, 400)

        request = self.factory.post(
            f"/events/api/events/{event.id}/participants/unblock",
            data=json.dumps({}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.unblock_participants(request, event.id)
        self.assertEqual(response.status_code, 400)

    def test_websites_post_invalid_domain(self):
        request = self.factory.post(
            "/events/api/websites/",
            data=json.dumps({"hostname": "http://bad-domain"}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.websites(request)
        self.assertEqual(response.status_code, 400)

    def test_website_detail_not_found(self):
        request = self.factory.put(
            "/events/api/websites/9999/",
            data=json.dumps({"hostname": "example.com"}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.website_detail(request, 9999)
        self.assertEqual(response.status_code, 404)

    def test_send_key_emails_event_not_found(self):
        request = self.factory.post(
            "/events/api/events/9999/send-keys/",
            data=json.dumps({"participantIds": []}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.send_key_emails(request, 9999)
        self.assertEqual(response.status_code, 404)

    def test_send_key_emails_failure_response(self):
        event = Event.objects.create(
            name="Email Fail Event",
            description="Email fail",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="programado",
        )
        request = self.factory.post(
            f"/events/api/events/{event.id}/send-keys/",
            data=json.dumps({"participantIds": []}),
            content_type="application/json",
            **self._auth_headers(),
        )
        with mock.patch(
            "events.views.send_emails",
            return_value={"success": False, "error": "fail"},
        ):
            response = views.send_key_emails(request, event.id)
        self.assertEqual(response.status_code, 400)

    def test_event_detail_delete_forbidden_and_in_progress(self):
        now = timezone.now()
        evaluator_user = CustomUser.objects.create(
            email="evaldelete@example.com",
            first_name="Eval",
            last_name="Delete",
            password="hashed",
        )
        UserRole.objects.create(user=evaluator_user, role="evaluator")
        evaluator_token = generate_token(evaluator_user)

        event = Event.objects.create(
            name="Delete Guard Event",
            description="Delete guard",
            start_date=now + timedelta(days=1),
            close_date=now + timedelta(days=1, minutes=10),
            end_date=now + timedelta(days=1, minutes=40),
            duration=30,
            evaluator=self.admin,
            status="programado",
        )

        request = self.factory.delete(
            f"/events/api/events/{event.id}",
            HTTP_AUTHORIZATION=f"Bearer {evaluator_token}",
        )
        response = views.event_detail(request, event.id)
        self.assertEqual(response.status_code, 403)

        event.status = "en_progreso"
        event.save()
        request = self.factory.delete(
            f"/events/api/events/{event.id}",
            **self._auth_headers(),
        )
        response = views.event_detail(request, event.id)
        self.assertEqual(response.status_code, 400)

    def test_start_finish_event_not_found(self):
        request = self.factory.post("/events/api/events-status/9999/start/")
        response = views.start_event(request, 9999)
        self.assertEqual(response.status_code, 404)

        request = self.factory.post("/events/api/events-status/9999/finish/")
        response = views.finish_event(request, 9999)
        self.assertEqual(response.status_code, 404)

    def test_start_finish_event_invalid_status(self):
        now = timezone.now()
        event_start_invalid = Event.objects.create(
            name="Start Invalid",
            description="Start invalid",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        request = self.factory.post(
            f"/events/api/events-status/{event_start_invalid.id}/start/"
        )
        response = views.start_event(request, event_start_invalid.id)
        self.assertEqual(response.status_code, 400)

        event_finish_invalid = Event.objects.create(
            name="Finish Invalid",
            description="Finish invalid",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=10,
            evaluator=self.admin,
            status="programado",
        )
        request = self.factory.post(
            f"/events/api/events-status/{event_finish_invalid.id}/finish/"
        )
        response = views.finish_event(request, event_finish_invalid.id)
        self.assertEqual(response.status_code, 400)

    def test_event_blocked_hosts_not_found(self):
        request = self.factory.get(
            "/events/api/blocked-hosts/9999/",
            **self._auth_headers(),
        )
        response = views.event_blocked_hosts(request, 9999)
        self.assertEqual(response.status_code, 404)

    def test_log_participant_http_event_missing_auth(self):
        request = self.factory.post(
            "/events/api/logging/http-request",
            data=json.dumps({"uri": "http://example.com"}),
            content_type="application/json",
        )
        response = views.log_participant_http_event(request)
        self.assertEqual(response.status_code, 401)

    def test_log_participant_http_event_not_monitoring(self):
        event = Event.objects.create(
            name="HTTP Not Monitoring",
            description="HTTP",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="HTTP",
            last_name="User",
            name="HTTP User",
            email="httpnm@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant, is_monitoring=False
        )
        request = self.factory.post(
            "/events/api/logging/http-request",
            data=json.dumps({"uri": "http://example.com"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        response = views.log_participant_http_event(request)
        self.assertEqual(response.status_code, 403)

    def test_log_participant_screen_event_upload_failure(self):
        event = Event.objects.create(
            name="Screen Fail",
            description="Screen",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Screen",
            last_name="User",
            name="Screen User",
            email="screenfail@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant, is_monitoring=True
        )
        upload = SimpleUploadedFile("screen.png", b"data", content_type="image/png")
        request = self.factory.post(
            "/events/api/logging/screen/capture",
            data={"screenshot": upload, "monitor_name": "Screen"},
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        with mock.patch(
            "events.views.s3_service.upload_media_fragment",
            return_value={"success": False, "error": "fail"},
        ):
            response = views.log_participant_screen_event(request)
        self.assertEqual(response.status_code, 500)

    def test_log_participant_audio_video_event_upload_failure(self):
        event = Event.objects.create(
            name="Media Fail",
            description="Media",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Media",
            last_name="User",
            name="Media User",
            email="mediafail@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant, is_monitoring=True
        )
        upload = SimpleUploadedFile("media.webm", b"data", content_type="video/webm")
        request = self.factory.post(
            "/events/api/logging/media/capture",
            data={"media": upload},
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        with mock.patch(
            "events.views.s3_service.upload_media_fragment",
            return_value={"success": False, "error": "fail"},
        ):
            response = views.log_participant_audio_video_event(request)
        self.assertEqual(response.status_code, 500)

    def test_send_key_emails_invalid_json(self):
        event = Event.objects.create(
            name="Email Invalid JSON",
            description="Email",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="programado",
        )
        request = self.factory.post(
            f"/events/api/events/{event.id}/send-keys/",
            data="{bad json}",
            content_type="application/json",
            **self._auth_headers(),
        )
        with mock.patch(
            "events.views.send_emails", return_value={"success": True, "sent": 0}
        ):
            response = views.send_key_emails(request, event.id)
        self.assertEqual(response.status_code, 200)

    def test_participants_post_missing_fields(self):
        request = self.factory.post(
            "/events/api/participants",
            data=json.dumps({"first_name": "Only"}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.participants(request)
        self.assertEqual(response.status_code, 400)
