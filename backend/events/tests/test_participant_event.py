from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events.models import Event, Participant, ParticipantEvent


class ParticipantEventTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.evaluator = CustomUser.objects.create(
            email="eval@example.com",
            first_name="Eva",
            last_name="Luador",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Event A",
            description="Test event",
            start_date=now - timedelta(hours=1),
            close_date=now + timedelta(hours=1),
            end_date=now + timedelta(hours=2),
            duration=5,
            evaluator=self.evaluator,
            status="programado",
        )
        self.participant = Participant.objects.create(
            first_name="Pat",
            last_name="Ticipant",
            name="Pat Ticipant",
            email="pat@example.com",
        )
        self.participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=self.participant
        )

    def test_get_total_monitoring_time_includes_current_session(self):
        now = timezone.now()
        self.participant_event.monitoring_total_duration = 120
        self.participant_event.is_monitoring = True
        self.participant_event.monitoring_current_session_time = now - timedelta(
            seconds=90
        )
        self.participant_event.save()

        self.assertEqual(self.participant_event.get_total_monitoring_time(), 3)

    def test_remaining_time_helpers(self):
        now = timezone.now()
        self.participant_event.monitoring_total_duration = 120
        self.participant_event.is_monitoring = True
        self.participant_event.monitoring_current_session_time = now - timedelta(
            seconds=60
        )
        self.participant_event.save()

        self.assertTrue(self.participant_event.has_monitoring_time_remaining())
        self.assertEqual(self.participant_event.get_remaining_monitoring_time(), 2)
