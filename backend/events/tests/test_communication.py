from unittest import mock

from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events.communication import send_emails
from events.models import Event, Participant, ParticipantEvent


class CommunicationTests(TestCase):
    def setUp(self):
        self.evaluator = CustomUser.objects.create(
            email="mail@example.com",
            first_name="Mail",
            last_name="User",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Mail Event",
            description="Mail",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=15,
            evaluator=self.evaluator,
            status="programado",
        )
        participant = Participant.objects.create(
            first_name="Mail",
            last_name="Participant",
            name="Mail Participant",
            email="participant@example.com",
        )
        ParticipantEvent.objects.create(event=self.event, participant=participant)

    def test_send_emails_event_not_found(self):
        result = send_emails(999)
        self.assertFalse(result["success"])

    def test_send_emails_success(self):
        with mock.patch("events.communication.MJ_APIKEY_PUBLIC", "pub"), mock.patch(
            "events.communication.MJ_APIKEY_PRIVATE", "priv"
        ), mock.patch(
            "events.communication.EMAIL_SENDER", "sender@example.com"
        ), mock.patch(
            "events.communication.requests.post"
        ) as post_mock:
            post_mock.return_value.ok = True
            post_mock.return_value.status_code = 200
            post_mock.return_value.text = "OK"

            result = send_emails(self.event.id)

        self.assertTrue(result["success"])
        self.assertEqual(result["sent"], 1)
