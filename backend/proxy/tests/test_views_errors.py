import json
from datetime import timedelta
from unittest import mock

from django.test import RequestFactory, TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events.models import Event, Participant, ParticipantEvent
from proxy import views


class ProxyViewsErrorTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        now = timezone.now()
        self.evaluator = CustomUser.objects.create(
            email="proxy-errors@example.com",
            first_name="Proxy",
            last_name="Errors",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Proxy Error Event",
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
            email="proxyerr@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=self.participant
        )

    def test_proxy_test_endpoint(self):
        request = self.factory.get("/proxy/test/")
        response = views.proxy_test(request)
        self.assertEqual(response.status_code, 200)

    def test_start_monitoring_invalid_auth(self):
        request = self.factory.post("/proxy/start-monitoring/")
        response = views.start_monitoring(request)
        self.assertEqual(response.status_code, 401)

    def test_start_monitoring_not_allowed(self):
        request = self.factory.post(
            "/proxy/start-monitoring/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        with mock.patch(
            "proxy.views.validate_event_access",
            return_value={"monitoring_allowed": False},
        ):
            response = views.start_monitoring(request)
        self.assertEqual(response.status_code, 403)

    def test_start_monitoring_already_active_sets_time(self):
        self.participant_event.is_monitoring = True
        self.participant_event.monitoring_current_session_time = None
        self.participant_event.save()

        request = self.factory.post(
            "/proxy/start-monitoring/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        response = views.start_monitoring(request)

        self.participant_event.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(self.participant_event.monitoring_current_session_time)

    def test_start_monitoring_not_found(self):
        request = self.factory.post(
            "/proxy/start-monitoring/", HTTP_AUTHORIZATION="Bearer missing"
        )
        response = views.start_monitoring(request)
        self.assertEqual(response.status_code, 404)

    def test_stop_monitoring_invalid_auth(self):
        request = self.factory.post("/proxy/stop-monitoring/")
        response = views.stop_monitoring(request)
        self.assertEqual(response.status_code, 401)

    def test_stop_monitoring_time_anomaly(self):
        self.participant_event.is_monitoring = True
        self.participant_event.monitoring_current_session_time = timezone.now() + timedelta(
            seconds=10
        )
        self.participant_event.save()

        request = self.factory.post(
            "/proxy/stop-monitoring/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        response = views.stop_monitoring(request)

        self.participant_event.refresh_from_db()
        self.assertEqual(response.status_code, 200)
        self.assertFalse(self.participant_event.is_monitoring)

    def test_stop_monitoring_not_found(self):
        request = self.factory.post(
            "/proxy/stop-monitoring/", HTTP_AUTHORIZATION="Bearer missing"
        )
        response = views.stop_monitoring(request)
        self.assertEqual(response.status_code, 404)

    def test_proxy_authenticate_http_missing_token(self):
        request = self.factory.post("/proxy/auth-http/")
        response = views.proxy_authenticate_http(request)
        self.assertEqual(response.status_code, 401)

    def test_proxy_authenticate_http_invalid_token(self):
        request = self.factory.post(
            "/proxy/auth-http/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            return_value=None,
        ):
            response = views.proxy_authenticate_http(request)
        self.assertEqual(response.status_code, 401)

    def test_proxy_authenticate_http_exception(self):
        request = self.factory.post(
            "/proxy/auth-http/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            side_effect=RuntimeError("boom"),
        ):
            response = views.proxy_authenticate_http(request)
        self.assertEqual(response.status_code, 500)

    def test_proxy_validate_url_invalid_json(self):
        request = self.factory.post(
            "/proxy/validate/",
            data="{",
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            return_value=self.participant_event,
        ):
            response = views.proxy_validate_url(request)
        self.assertEqual(response.status_code, 400)

    def test_proxy_validate_url_missing_url(self):
        request = self.factory.post(
            "/proxy/validate/",
            data=json.dumps({}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            return_value=self.participant_event,
        ):
            response = views.proxy_validate_url(request)
        self.assertEqual(response.status_code, 400)

    def test_proxy_validate_url_invalid_token(self):
        request = self.factory.post(
            "/proxy/validate/",
            data=json.dumps({"url": "http://example.com"}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            return_value=None,
        ):
            response = views.proxy_validate_url(request)
        self.assertEqual(response.status_code, 401)

    def test_proxy_disconnect_http_missing_token(self):
        request = self.factory.post("/proxy/disconnect-http/")
        response = views.proxy_disconnect_http(request)
        self.assertEqual(response.status_code, 401)

    def test_proxy_disconnect_http_invalid_token(self):
        request = self.factory.post(
            "/proxy/disconnect-http/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            return_value=None,
        ):
            response = views.proxy_disconnect_http(request)
        self.assertEqual(response.status_code, 401)

    def test_proxy_disconnect_http_exception(self):
        request = self.factory.post(
            "/proxy/disconnect-http/",
            HTTP_AUTHORIZATION=f"Bearer {self.participant_event.event_key}",
        )
        with mock.patch(
            "proxy.views.DynamicProxyManager._validate_event_key",
            side_effect=RuntimeError("boom"),
        ):
            response = views.proxy_disconnect_http(request)
        self.assertEqual(response.status_code, 500)
