import json
from datetime import timedelta
from unittest import mock

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase
from django.utils import timezone

from authentication.models import CustomUser, UserRole
from authentication.utils import generate_token
from events.models import (
    Event,
    Participant,
    ParticipantEvent,
    ParticipantLog,
    Website,
    BlockedHost,
)
from events import views


class EventsViewsTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.admin = CustomUser.objects.create(
            email="admin@example.com",
            first_name="Admin",
            last_name="User",
            password="hashed",
        )
        UserRole.objects.create(user=self.admin, role="admin")
        self.admin_token = generate_token(self.admin)

    def _auth_headers(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.admin_token}"}

    def test_participants_get_and_post(self):
        request = self.factory.post(
            "/events/api/participants",
            data=json.dumps(
                {"first_name": "Ana", "last_name": "User", "email": "ana@example.com"}
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.participants(request)
        self.assertEqual(response.status_code, 200)

        request = self.factory.get(
            "/events/api/participants?search=ana", **self._auth_headers()
        )
        response = views.participants(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(len(payload["participants"]), 1)

    def test_participant_detail_put_and_delete(self):
        participant = Participant.objects.create(
            first_name="Bob",
            last_name="Tester",
            name="Bob Tester",
            email="bob@example.com",
        )
        request = self.factory.put(
            f"/events/api/participants/{participant.id}",
            data=json.dumps(
                {
                    "first_name": "Bob",
                    "last_name": "Updated",
                    "email": "bob@example.com",
                }
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.participant_detail(request, participant.id)
        self.assertEqual(response.status_code, 200)

        request = self.factory.delete(
            f"/events/api/participants/{participant.id}",
            **self._auth_headers(),
        )
        response = views.participant_detail(request, participant.id)
        self.assertEqual(response.status_code, 200)

    def test_events_get_and_post_success(self):
        evaluator = CustomUser.objects.create(
            email="evaluator@example.com",
            first_name="Eval",
            last_name="User",
            password="hashed",
        )
        Participant.objects.create(
            first_name="P1",
            last_name="User",
            name="P1 User",
            email="p1@example.com",
        )
        participant = Participant.objects.first()

        start_dt = timezone.now() + timedelta(days=1)
        start_dt = start_dt.replace(second=0, microsecond=0)
        close_dt = start_dt + timedelta(minutes=10)

        request = self.factory.post(
            "/events/api/events",
            data=json.dumps(
                {
                    "eventName": "Event One",
                    "description": "Event description",
                    "startDate": start_dt.strftime("%Y-%m-%d"),
                    "startTime": start_dt.strftime("%H:%M"),
                    "closeTime": close_dt.strftime("%H:%M"),
                    "evaluator": evaluator.id,
                    "duration": 30,
                    "timezone": "UTC",
                    "participants": [
                        {
                            "id": participant.id,
                            "selected": True,
                        }
                    ],
                    "blockedWebsites": [],
                }
            ),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.events(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 200, response.content)
        self.assertTrue(payload["success"])

        request = self.factory.get("/events/api/events", **self._auth_headers())
        response = views.events(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(len(payload["events"]), 1)

    def test_event_detail_get(self):
        evaluator = CustomUser.objects.create(
            email="detail@example.com",
            first_name="Eval",
            last_name="User",
            password="hashed",
        )
        now = timezone.now()
        event = Event.objects.create(
            name="Detail Event",
            description="Detail",
            start_date=now + timedelta(days=1),
            close_date=now + timedelta(days=1, minutes=10),
            end_date=now + timedelta(days=1, minutes=40),
            duration=30,
            evaluator=evaluator,
            status="programado",
        )
        participant = Participant.objects.create(
            first_name="Detail",
            last_name="User",
            name="Detail User",
            email="detail@example.com",
        )
        ParticipantEvent.objects.create(event=event, participant=participant)

        request = self.factory.get(
            f"/events/api/events/{event.id}", **self._auth_headers()
        )
        response = views.event_detail(request, event.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["event"]["name"], "Detail Event")

    def test_event_detail_put_completed_forbidden(self):
        evaluator = CustomUser.objects.create(
            email="edit@example.com",
            first_name="Eval",
            last_name="User",
            password="hashed",
        )
        now = timezone.now()
        event = Event.objects.create(
            name="Edit Event",
            description="Edit",
            start_date=now + timedelta(days=1),
            close_date=now + timedelta(days=1, minutes=10),
            end_date=now + timedelta(days=1, minutes=40),
            duration=30,
            evaluator=evaluator,
            status="completado",
        )

        request = self.factory.put(
            f"/events/api/events/{event.id}",
            data=json.dumps({"eventName": "Edit Event"}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.event_detail(request, event.id)
        self.assertEqual(response.status_code, 400)

    def test_pending_start_and_finish(self):
        evaluator = CustomUser.objects.create(
            email="pending@example.com",
            first_name="Eval",
            last_name="User",
            password="hashed",
        )
        now = timezone.now()
        start_event = Event.objects.create(
            name="Start Event",
            description="Start",
            start_date=now - timedelta(minutes=5),
            close_date=now + timedelta(minutes=5),
            end_date=now + timedelta(minutes=10),
            duration=15,
            evaluator=evaluator,
            status="programado",
        )
        finish_event = Event.objects.create(
            name="Finish Event",
            description="Finish",
            start_date=now - timedelta(minutes=30),
            close_date=now - timedelta(minutes=20),
            end_date=now - timedelta(minutes=5),
            duration=20,
            evaluator=evaluator,
            status="en_progreso",
        )

        request = self.factory.get("/events/api/events-status/pending-start/")
        response = views.pending_start_events(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["results"][0]["id"], start_event.id)

        request = self.factory.get("/events/api/events-status/pending-finish/")
        response = views.pending_finish_events(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["results"][0]["id"], finish_event.id)

    def test_start_and_finish_event(self):
        evaluator = CustomUser.objects.create(
            email="status@example.com",
            first_name="Eval",
            last_name="User",
            password="hashed",
        )
        now = timezone.now()
        event = Event.objects.create(
            name="Status Event",
            description="Status",
            start_date=now - timedelta(minutes=5),
            close_date=now + timedelta(minutes=5),
            end_date=now + timedelta(minutes=10),
            duration=15,
            evaluator=evaluator,
            status="programado",
        )
        request = self.factory.post(f"/events/api/events-status/{event.id}/start/")
        response = views.start_event(request, event.id)
        event.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(event.status, "en_progreso")

        request = self.factory.post(f"/events/api/events-status/{event.id}/finish/")
        response = views.finish_event(request, event.id)
        event.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(event.status, "completado")

    def test_websites_and_blocked_hosts(self):
        request = self.factory.post(
            "/events/api/websites/",
            data=json.dumps({"hostname": "blocked.com"}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.websites(request)
        self.assertEqual(response.status_code, 200)

        website = Website.objects.first()
        now = timezone.now()
        event = Event.objects.create(
            name="Blocked Event",
            description="Blocked",
            start_date=now + timedelta(days=1),
            close_date=now + timedelta(days=1, minutes=10),
            end_date=now + timedelta(days=1, minutes=40),
            duration=30,
            evaluator=self.admin,
            status="programado",
        )
        BlockedHost.objects.create(event=event, website=website)

        request = self.factory.get(
            f"/events/api/{event.id}/blocked-hosts/",
            **self._auth_headers(),
        )
        response = views.event_blocked_hosts(request, event.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["blocked_website_ids"], [str(website.id)])

    def test_evaluaciones_and_detail(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Eval Event",
            description="Eval",
            start_date=now - timedelta(minutes=5),
            close_date=now + timedelta(minutes=5),
            end_date=now + timedelta(minutes=10),
            duration=20,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Eval",
            last_name="Participant",
            name="Eval Participant",
            email="evalp@example.com",
        )
        ParticipantEvent.objects.create(
            event=event, participant=participant, is_monitoring=True
        )

        request = self.factory.get("/events/api/evaluations", **self._auth_headers())
        response = views.evaluaciones(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(len(payload["evaluaciones"]), 1)

        request = self.factory.get(
            f"/events/api/evaluations/{event.id}", **self._auth_headers()
        )
        response = views.evaluation_detail(request, event.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["event"]["id"], str(event.id))

    def test_event_participant_logs(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Logs Event",
            description="Logs",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Logs",
            last_name="User",
            name="Logs User",
            email="logs@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant
        )
        ParticipantLog.objects.create(
            name="screen",
            message="Screen",
            url="media/screen.jpg",
            participant_event=participant_event,
        )

        request = self.factory.get(
            f"/events/api/events/{event.id}/participants/{participant.id}/logs/",
            **self._auth_headers(),
        )
        with mock.patch(
            "events.views.s3_service.is_configured", return_value=True
        ), mock.patch(
            "events.views.s3_service.generate_presigned_url", return_value="signed"
        ):
            response = views.event_participant_logs(request, event.id, participant.id)

        self.assertEqual(response.status_code, 200)

    def test_log_participant_http_event(self):
        now = timezone.now()
        event = Event.objects.create(
            name="HTTP Event",
            description="HTTP",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="HTTP",
            last_name="User",
            name="HTTP User",
            email="http@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant, is_monitoring=True
        )
        request = self.factory.post(
            "/events/api/logging/http-request",
            data=json.dumps({"uri": "http://blocked.com", "type": "http"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        response = views.log_participant_http_event(request)
        self.assertEqual(response.status_code, 200)

    def test_log_participant_screen_event(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Screen Event",
            description="Screen",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=10,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Screen",
            last_name="User",
            name="Screen User",
            email="screen@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant, is_monitoring=True
        )
        upload = SimpleUploadedFile("screen.png", b"data", content_type="image/png")
        request = self.factory.post(
            "/events/api/logging/screen/capture",
            data={"screenshot": upload, "monitor_name": "Screen 1"},
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        with mock.patch(
            "events.views.s3_service.upload_media_fragment",
            return_value={
                "success": True,
                "key": "media/key",
                "presigned_url": "signed",
            },
        ):
            response = views.log_participant_screen_event(request)
        self.assertEqual(response.status_code, 200)

    def test_log_participant_audio_video_event(self):
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
            email="media@example.com",
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
            return_value={
                "success": True,
                "key": "media/key",
                "presigned_url": "signed",
            },
        ):
            response = views.log_participant_audio_video_event(request)
        self.assertEqual(response.status_code, 200)

    def test_notify_proxy_blocked_hosts_update(self):
        event = Event.objects.create(
            name="Notify Event",
            description="Notify",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="programado",
        )
        request = self.factory.post(
            f"/events/api/{event.id}/notify-proxy-update/",
            **self._auth_headers(),
        )
        response = views.notify_proxy_blocked_hosts_update(request, event.id)
        self.assertEqual(response.status_code, 200)

    def test_websites_put_and_delete(self):
        request = self.factory.post(
            "/events/api/websites/",
            data=json.dumps({"hostname": "example.com"}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.websites(request)
        self.assertEqual(response.status_code, 200)
        website = Website.objects.first()

        request = self.factory.put(
            f"/events/api/websites/{website.id}/",
            data=json.dumps({"hostname": "example.org"}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.website_detail(request, website.id)
        self.assertEqual(response.status_code, 200)

        BlockedHost.objects.create(
            event=Event.objects.create(
                name="Block Event",
                description="Block",
                start_date=timezone.now(),
                close_date=timezone.now(),
                end_date=timezone.now(),
                duration=10,
                evaluator=self.admin,
                status="programado",
            ),
            website=website,
        )

        request = self.factory.delete(
            f"/events/api/websites/{website.id}/",
            **self._auth_headers(),
        )
        response = views.website_detail(request, website.id)
        self.assertEqual(response.status_code, 400)

    def test_verify_event_key_success_and_not_found(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Verify Event",
            description="Verify",
            start_date=now - timedelta(minutes=2),
            close_date=now + timedelta(minutes=5),
            end_date=now + timedelta(minutes=10),
            duration=15,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Verify",
            last_name="User",
            name="Verify User",
            email="verify@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event, participant=participant
        )

        request = self.factory.get(
            "/events/api/verify-event-key",
            HTTP_AUTHORIZATION=f"Bearer {participant_event.event_key}",
        )
        response = views.verify_event_key(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(payload["isValid"])

        request = self.factory.get(
            "/events/api/verify-event-key",
            HTTP_AUTHORIZATION="Bearer missing",
        )
        response = views.verify_event_key(request)
        self.assertEqual(response.status_code, 404)

    def test_send_key_emails_forbidden_and_success(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Send Email Event",
            description="Send Email",
            start_date=now + timedelta(days=1),
            close_date=now + timedelta(days=1, minutes=10),
            end_date=now + timedelta(days=1, minutes=40),
            duration=30,
            evaluator=self.admin,
            status="programado",
        )

        other_user = CustomUser.objects.create(
            email="other@example.com",
            first_name="Other",
            last_name="User",
            password="hashed",
        )
        UserRole.objects.create(user=other_user, role="evaluator")
        other_token = generate_token(other_user)

        request = self.factory.post(
            f"/events/api/events/{event.id}/send-keys/",
            data=json.dumps({"participantIds": []}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {other_token}",
        )
        response = views.send_key_emails(request, event.id)
        self.assertEqual(response.status_code, 403)

        request = self.factory.post(
            f"/events/api/events/{event.id}/send-keys/",
            data=json.dumps({"participantIds": []}),
            content_type="application/json",
            **self._auth_headers(),
        )
        with mock.patch(
            "events.views.send_emails", return_value={"success": True, "sent": 0}
        ):
            response = views.send_key_emails(request, event.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(payload["success"])

    def test_event_detail_put_updates_event(self):
        evaluator = CustomUser.objects.create(
            email="update@example.com",
            first_name="Eval",
            last_name="Update",
            password="hashed",
        )
        now = timezone.now()
        event = Event.objects.create(
            name="Original Event",
            description="Original",
            start_date=now + timedelta(days=1),
            close_date=now + timedelta(days=1, minutes=10),
            end_date=now + timedelta(days=1, minutes=40),
            duration=30,
            evaluator=evaluator,
            status="programado",
        )
        participant_old = Participant.objects.create(
            first_name="Old",
            last_name="Participant",
            name="Old Participant",
            email="oldp@example.com",
        )
        participant_new = Participant.objects.create(
            first_name="New",
            last_name="Participant",
            name="New Participant",
            email="newp@example.com",
        )
        ParticipantEvent.objects.create(event=event, participant=participant_old)

        old_website = Website.objects.create(hostname="oldsite.com")
        BlockedHost.objects.create(event=event, website=old_website)
        new_website = Website.objects.create(hostname="newsite.com")

        start_dt = now + timedelta(days=2)
        start_dt = start_dt.replace(second=0, microsecond=0)
        close_dt = start_dt + timedelta(minutes=10)

        payload = {
            "eventName": "Updated Event",
            "description": "Updated description",
            "startDate": start_dt.strftime("%Y-%m-%d"),
            "startTime": start_dt.strftime("%H:%M"),
            "closeTime": close_dt.strftime("%H:%M"),
            "evaluator": evaluator.id,
            "duration": 30,
            "timezone": "UTC",
            "participants": [
                {"id": participant_old.id, "selected": False},
                {"id": participant_new.id, "selected": True},
            ],
            "blockedWebsites": [new_website.id],
        }

        request = self.factory.put(
            f"/events/api/events/{event.id}",
            data=json.dumps(payload),
            content_type="application/json",
            **self._auth_headers(),
        )
        with mock.patch("events.views.print"):
            response = views.event_detail(request, event.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(payload["success"])
        event.refresh_from_db()
        self.assertEqual(event.name, "Updated Event")

    def test_event_detail_delete_admin(self):
        event = Event.objects.create(
            name="Delete Event",
            description="Delete",
            start_date=timezone.now() + timedelta(days=1),
            close_date=timezone.now() + timedelta(days=1, minutes=10),
            end_date=timezone.now() + timedelta(days=1, minutes=40),
            duration=30,
            evaluator=self.admin,
            status="programado",
        )
        request = self.factory.delete(
            f"/events/api/events/{event.id}",
            **self._auth_headers(),
        )
        response = views.event_detail(request, event.id)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Event.objects.filter(id=event.id).exists())

    def test_get_proxy_status_and_connection_stats(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Proxy Status Event",
            description="Proxy Status",
            start_date=now,
            close_date=now + timedelta(minutes=5),
            end_date=now + timedelta(minutes=10),
            duration=20,
            evaluator=self.admin,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Conn",
            last_name="User",
            name="Conn User",
            email="conn@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=event,
            participant=participant,
            is_monitoring=True,
            monitoring_sessions_count=2,
        )

        request = self.factory.get(
            f"/events/api/events/{event.id}/proxy-status/",
            **self._auth_headers(),
        )
        response = views.get_proxy_status(request, event.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(payload["success"])
        self.assertEqual(payload["total_participants"], 1)

        request = self.factory.get(
            f"/events/api/events/{event.id}/participants/{participant.id}/connection/",
            **self._auth_headers(),
        )
        response = views.participant_connection_stats(request, event.id, participant.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["participant"]["id"], participant.id)
        self.assertTrue(payload["monitoring_is_active"])

    def test_participant_media_files_invalid_date_and_success(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Media Files Event",
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
            email="mediafiles@example.com",
        )
        ParticipantEvent.objects.create(event=event, participant=participant)

        request = self.factory.get(
            f"/events/api/events/{event.id}/participants/{participant.id}/media/?start_date=bad",
            **self._auth_headers(),
        )
        with mock.patch(
            "events.views.s3_service.is_configured", return_value=True
        ):
            response = views.participant_media_files(request, event.id, participant.id)
        self.assertEqual(response.status_code, 400)

        request = self.factory.get(
            f"/events/api/events/{event.id}/participants/{participant.id}/media/",
            **self._auth_headers(),
        )
        with mock.patch(
            "events.views.s3_service.is_configured", return_value=True
        ), mock.patch(
            "events.views.s3_service.list_participant_media",
            return_value=[{"media_type": "video", "size": 10}],
        ):
            response = views.participant_media_files(request, event.id, participant.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(payload["success"])
        self.assertEqual(payload["summary"]["total_files"], 1)

    def test_events_get_for_evaluator(self):
        evaluator = CustomUser.objects.create(
            email="eval-list@example.com",
            first_name="Eval",
            last_name="List",
            password="hashed",
        )
        UserRole.objects.create(user=evaluator, role="evaluator")
        token = generate_token(evaluator)

        Event.objects.create(
            name="Evaluator Event",
            description="Eval list",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=evaluator,
            status="programado",
        )

        request = self.factory.get(
            "/events/api/events",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )
        response = views.events(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(len(payload["events"]), 1)

    def test_participant_detail_get(self):
        event = Event.objects.create(
            name="Detail Participant",
            description="Detail participant",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="programado",
        )
        participant = Participant.objects.create(
            first_name="Detail",
            last_name="Participant",
            name="Detail Participant",
            email="detailp@example.com",
        )
        ParticipantEvent.objects.create(event=event, participant=participant)

        request = self.factory.get(
            f"/events/api/participants/{participant.id}",
            **self._auth_headers(),
        )
        response = views.participant_detail(request, participant.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["participant"]["id"], participant.id)

    def test_websites_get(self):
        Website.objects.create(hostname="listone.com")
        Website.objects.create(hostname="listtwo.com")
        request = self.factory.get(
            "/events/api/websites/",
            **self._auth_headers(),
        )
        response = views.websites(request)
        payload = json.loads(response.content.decode("utf-8"))
        hostnames = {site["hostname"] for site in payload["websites"]}
        self.assertIn("listone.com", hostnames)
        self.assertIn("listtwo.com", hostnames)

    def test_block_unblock_participants_success(self):
        event = Event.objects.create(
            name="Block Event Success",
            description="Block success",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=self.admin,
            status="programado",
        )
        participant = Participant.objects.create(
            first_name="Block",
            last_name="User",
            name="Block User",
            email="blockuser@example.com",
        )
        ParticipantEvent.objects.create(event=event, participant=participant)

        request = self.factory.post(
            f"/events/api/events/{event.id}/participants/block",
            data=json.dumps({"participant_ids": [participant.id]}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.block_participants(request, event.id)
        self.assertEqual(response.status_code, 200)

        request = self.factory.post(
            f"/events/api/events/{event.id}/participants/unblock",
            data=json.dumps({"participant_ids": [participant.id]}),
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.unblock_participants(request, event.id)
        self.assertEqual(response.status_code, 200)
