from datetime import timedelta
from types import SimpleNamespace
from unittest import mock

from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events.models import BlockedHost, Event, Participant, ParticipantEvent, Website
from proxy.server_proxy import DynamicProxyManager


class DynamicProxyManagerTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.evaluator = CustomUser.objects.create(
            email="eval3@example.com",
            first_name="Eva",
            last_name="Luador",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Event C",
            description="Proxy test",
            start_date=now - timedelta(hours=1),
            close_date=now + timedelta(hours=1),
            end_date=now + timedelta(hours=2),
            duration=20,
            evaluator=self.evaluator,
            status="en_progreso",
        )
        self.participant = Participant.objects.create(
            first_name="Proxy",
            last_name="User",
            name="Proxy User",
            email="proxy@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=self.participant
        )
        self.participant_event.is_monitoring = True
        self.participant_event.save()

        self.website = Website.objects.create(hostname="blocked.com")
        BlockedHost.objects.create(event=self.event, website=self.website)

    def test_validate_url_http_blocks_and_logs(self):
        manager = DynamicProxyManager()

        with mock.patch.object(
            manager, "_send_log_to_api"
        ) as send_log_mock, mock.patch.object(
            manager, "_should_log_block", return_value=True
        ):
            result = manager.validate_url_http(
                self.participant_event.event_key,
                "http://blocked.com/page",
                "GET",
            )

        self.assertTrue(result["blocked"])
        send_log_mock.assert_called_once()

    def test_validate_url_http_allows_unblocked(self):
        manager = DynamicProxyManager()

        with mock.patch.object(manager, "_send_log_to_api") as send_log_mock:
            result = manager.validate_url_http(
                self.participant_event.event_key,
                "http://allowed.com/page",
                "GET",
            )

        self.assertFalse(result["blocked"])
        send_log_mock.assert_not_called()

    def test_should_log_block_cooldown(self):
        manager = DynamicProxyManager()
        cache_key = ("token", "example.com")

        first = manager._should_log_block(cache_key, cooldown_seconds=10, ttl_seconds=30)
        second = manager._should_log_block(cache_key, cooldown_seconds=10, ttl_seconds=30)

        self.assertTrue(first)
        self.assertFalse(second)

    def test_validate_url_http_invalid_url(self):
        manager = DynamicProxyManager()
        result = manager.validate_url_http(self.participant_event.event_key, "not a url")
        self.assertTrue(result["blocked"])

    def test_validate_url_http_event_missing(self):
        manager = DynamicProxyManager()
        result = manager.validate_url_http("missing", "http://example.com")
        self.assertTrue(result["blocked"])

    def test_validate_url_http_blocked_not_monitoring(self):
        manager = DynamicProxyManager()
        self.participant_event.is_monitoring = False
        self.participant_event.save()

        with mock.patch.object(manager, "_send_log_to_api") as send_log_mock:
            result = manager.validate_url_http(
                self.participant_event.event_key,
                "http://blocked.com/page",
                "GET",
            )

        self.assertTrue(result["blocked"])
        send_log_mock.assert_not_called()

    def test_validate_event_key_inactive_event(self):
        manager = DynamicProxyManager()
        self.event.status = "completado"
        self.event.save()
        result = manager._validate_event_key(self.participant_event.event_key)
        self.assertIsNone(result)

    def test_send_log_to_api_skips_when_not_monitoring(self):
        manager = DynamicProxyManager()
        self.participant_event.is_monitoring = False
        self.participant_event.save()

        with mock.patch("proxy.server_proxy.threading.Thread") as thread_mock:
            manager._send_log_to_api(self.participant_event.event_key, "http://x")
        thread_mock.assert_not_called()

    def test_send_log_to_api_event_missing(self):
        manager = DynamicProxyManager()
        with mock.patch("proxy.server_proxy.threading.Thread") as thread_mock:
            manager._send_log_to_api("missing", "http://x")
        thread_mock.assert_not_called()

    def test_send_log_to_api_sends_when_monitoring(self):
        manager = DynamicProxyManager()
        self.participant_event.is_monitoring = True
        self.participant_event.save()

        class InstantThread:
            def __init__(self, target, args=(), daemon=None):
                self.target = target
                self.args = args

            def start(self):
                self.target(*self.args)

        with mock.patch(
            "proxy.server_proxy.threading.Thread", InstantThread
        ), mock.patch(
            "proxy.server_proxy.requests.post",
            return_value=SimpleNamespace(status_code=201),
        ) as post_mock, mock.patch(
            "proxy.server_proxy.time.sleep"
        ):
            manager._send_log_to_api(self.participant_event.event_key, "http://x")

        post_mock.assert_called()
