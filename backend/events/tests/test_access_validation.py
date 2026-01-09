from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events.models import Event, Participant, ParticipantEvent
from events.views import validate_event_access


class EventAccessValidationTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.evaluator = CustomUser.objects.create(
            email="eval2@example.com",
            first_name="Eva",
            last_name="Luador",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Event B",
            description="Access rules",
            start_date=now - timedelta(hours=1),
            close_date=now + timedelta(minutes=30),
            end_date=now + timedelta(hours=1),
            duration=10,
            evaluator=self.evaluator,
            status="programado",
        )
        self.participant = Participant.objects.create(
            first_name="P",
            last_name="E",
            name="P E",
            email="pe@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=self.participant
        )

    def test_blocked_participant_is_denied(self):
        now = timezone.now()
        self.participant_event.is_blocked = True
        self.participant_event.save()

        result = validate_event_access(self.participant_event, now)
        self.assertFalse(result["allowed"])
        self.assertFalse(result["monitoring_allowed"])

    def test_first_connection_after_close_date_is_denied(self):
        now = timezone.now()
        self.event.close_date = now - timedelta(minutes=1)
        self.event.end_date = now + timedelta(minutes=10)
        self.event.save()

        result = validate_event_access(self.participant_event, now)
        self.assertFalse(result["allowed"])
        self.assertFalse(result["monitoring_allowed"])
