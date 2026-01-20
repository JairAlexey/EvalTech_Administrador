import json
from datetime import timedelta
from unittest import mock

from django.test import RequestFactory, TestCase
from django.utils import timezone

from authentication.models import CustomUser, UserRole
from authentication.utils import generate_token
from events import views
from events.models import Event, Participant, ParticipantEvent, ParticipantLog


class CleanupMonitoringTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.user = CustomUser.objects.create(
            email="cleanup@example.com",
            first_name="Cleanup",
            last_name="User",
            password="hashed",
        )
        UserRole.objects.create(user=self.user, role="admin")
        self.token = generate_token(self.user)

    def _auth_headers(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def _create_participant_event(self):
        now = timezone.now()
        event = Event.objects.create(
            name="Cleanup Event",
            description="Cleanup",
            start_date=now - timedelta(minutes=10),
            close_date=now + timedelta(minutes=10),
            end_date=now + timedelta(minutes=20),
            duration=30,
            evaluator=self.user,
            status="en_progreso",
        )
        participant = Participant.objects.create(
            first_name="Cleanup",
            last_name="Participant",
            name="Cleanup Participant",
            email="cleanup.participant@example.com",
        )
        return ParticipantEvent.objects.create(
            event=event,
            participant=participant,
            is_monitoring=True,
            monitoring_sessions_count=1,
            monitoring_current_session_time=now - timedelta(seconds=300),
        )

    def test_cleanup_stale_monitoring_with_logs(self):
        now = timezone.now()
        participant_event = self._create_participant_event()
        log = ParticipantLog.objects.create(
            name="screen",
            message="Screen",
            url="media/screen.jpg",
            participant_event=participant_event,
        )
        ParticipantLog.objects.filter(pk=log.id).update(
            timestamp=now - timedelta(seconds=200)
        )

        request = self.factory.post(
            "/events/api/monitoring/cleanup-stale-logs/",
            data=json.dumps({"threshold_seconds": 180}),
            content_type="application/json",
            **self._auth_headers(),
        )
        with mock.patch("events.views.cache.delete") as cache_delete:
            response = views.cleanup_stale_monitoring_by_logs(request)

        payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(payload["success"])
        self.assertEqual(payload["stale_count"], 1)

        participant_event.refresh_from_db()
        self.assertFalse(participant_event.is_monitoring)
        self.assertIsNone(participant_event.monitoring_current_session_time)
        self.assertGreater(participant_event.monitoring_total_duration, 0)
        cache_delete.assert_called_once()

    def test_cleanup_stale_monitoring_invalid_json_defaults(self):
        participant_event = self._create_participant_event()
        participant_event.monitoring_current_session_time = None
        participant_event.save(update_fields=["monitoring_current_session_time"])

        request = self.factory.post(
            "/events/api/monitoring/cleanup-stale-logs/",
            data="{bad json}",
            content_type="application/json",
            **self._auth_headers(),
        )
        response = views.cleanup_stale_monitoring_by_logs(request)

        payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(payload["success"])
        self.assertEqual(payload["threshold_seconds"], 180)
        self.assertEqual(payload["stale_count"], 1)
