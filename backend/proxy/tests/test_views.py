import json
from datetime import timedelta
from unittest import mock

from django.test import RequestFactory, TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events.models import Event, Participant, ParticipantEvent
from proxy import views


class ProxyViewsTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        now = timezone.now()
        self.evaluator = CustomUser.objects.create(
            email="proxyview@example.com",
            first_name="Proxy",
            last_name="View",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Proxy View Event",
            description="Proxy",
            start_date=now - timedelta(minutes=5),
            close_date=now + timedelta(minutes=5),
            end_date=now + timedelta(minutes=10),
            duration=30,
            evaluator=self.evaluator,
            status="en_progreso",
        )
        self.participant = Participant.objects.create(
            first_name="Proxy",
            last_name="User",
            name="Proxy User",
            email="proxyuser@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=self.participant
        )

    def test_start_and_stop_monitoring(self):
        request = self.factory.post(
            "/proxy/start-monitoring/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        response = views.start_monitoring(request)
        self.assertEqual(response.status_code, 200)

        self.participant_event.refresh_from_db()
        self.assertTrue(self.participant_event.is_monitoring)

        self.participant_event.monitoring_current_session_time = timezone.now() - timedelta(
            seconds=5
        )
        self.participant_event.save()

        request = self.factory.post(
            "/proxy/stop-monitoring/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        response = views.stop_monitoring(request)
        self.assertEqual(response.status_code, 200)

        self.participant_event.refresh_from_db()
        self.assertFalse(self.participant_event.is_monitoring)
        self.assertGreaterEqual(self.participant_event.monitoring_total_duration, 0)

    def test_proxy_authenticate_http(self):
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            return_value=self.participant_event,
        ):
            request = self.factory.post(
                "/proxy/auth-http/",
                HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
            )
            response = views.proxy_authenticate_http(request)

        self.assertEqual(response.status_code, 200)

    def test_proxy_validate_url(self):
        with mock.patch(
            "proxy.views.DynamicProxyManager.validate_url_http",
            return_value={"blocked": False},
        ):
            request = self.factory.post(
                "/proxy/validate/",
                data=json.dumps({"method": "GET", "url": "http://example.com"}),
                content_type="application/json",
                HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
            )
            response = views.proxy_validate_url(request)

        self.assertEqual(response.status_code, 200)

    def test_proxy_disconnect_http(self):
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            return_value=self.participant_event,
        ):
            request = self.factory.post(
                "/proxy/disconnect-http/",
                HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
            )
            response = views.proxy_disconnect_http(request)

        self.assertEqual(response.status_code, 200)

    def test_proxy_blocklist_version(self):
        request = self.factory.get(
            "/proxy/blocklist-version/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        response = views.proxy_blocklist_version(request)

        self.assertEqual(response.status_code, 200)
        self.assertIn("version", json.loads(response.content))
