from datetime import timedelta
from unittest import mock

from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events.models import Event, Participant, ParticipantEvent
from events.views import (
    _validate_participant_fields,
    check_event_time,
    handle_event_participants,
    is_valid_domain,
    validate_event_access,
)


class EventsHelperTests(TestCase):
    def setUp(self):
        now = timezone.now()
        self.evaluator = CustomUser.objects.create(
            email="helper@example.com",
            first_name="Helper",
            last_name="User",
            password="hashed",
        )
        self.event = Event.objects.create(
            name="Helper Event",
            description="Helper",
            start_date=now + timedelta(hours=1),
            close_date=now + timedelta(hours=1, minutes=10),
            end_date=now + timedelta(hours=2),
            duration=30,
            evaluator=self.evaluator,
            status="programado",
        )

    def test_check_event_time(self):
        self.assertFalse(check_event_time(self.event))
        self.event.start_date = timezone.now() - timedelta(minutes=1)
        self.event.end_date = timezone.now() + timedelta(minutes=5)
        self.event.save()
        self.assertTrue(check_event_time(self.event))

    def test_is_valid_domain(self):
        self.assertTrue(is_valid_domain("example.com"))
        self.assertFalse(is_valid_domain("http://example.com"))

    def test_validate_participant_fields(self):
        seen_emails = set()
        fn, ln, em, errors = _validate_participant_fields(
            "", "", "bad-email", seen_emails
        )
        self.assertTrue(errors)

        Participant.objects.create(
            first_name="Existing",
            last_name="User",
            name="Existing User",
            email="dup@example.com",
        )
        _, _, _, errors = _validate_participant_fields(
            "Name", "Last", "dup@example.com", seen_emails
        )
        self.assertTrue(errors)

    def test_handle_event_participants(self):
        p1 = Participant.objects.create(
            first_name="P1",
            last_name="User",
            name="P1 User",
            email="p1@example.com",
        )
        p2 = Participant.objects.create(
            first_name="P2",
            last_name="User",
            name="P2 User",
            email="p2@example.com",
        )
        ParticipantEvent.objects.create(event=self.event, participant=p1)

        payload = [
            {"email": "p1@example.com", "selected": False},
            {"email": "p2@example.com", "selected": True},
        ]

        result = handle_event_participants(self.event, payload)

        self.assertEqual(result["added"], 1)
        self.assertEqual(result["removed"], 1)

    def test_validate_event_access_rules(self):
        participant = Participant.objects.create(
            first_name="Access",
            last_name="User",
            name="Access User",
            email="access@example.com",
        )
        participant_event = ParticipantEvent.objects.create(
            event=self.event, participant=participant
        )
        now = timezone.now()

        participant_event.is_blocked = True
        result = validate_event_access(participant_event, now)
        self.assertFalse(result["allowed"])

        participant_event.is_blocked = False
        participant_event.monitoring_sessions_count = 0
        result = validate_event_access(
            participant_event, self.event.close_date + timedelta(minutes=1)
        )
        self.assertFalse(result["allowed"])

        participant_event.monitoring_sessions_count = 1
        result = validate_event_access(participant_event, now)
        self.assertTrue(result["allowed"])

        result = validate_event_access(
            participant_event, self.event.end_date + timedelta(minutes=1)
        )
        self.assertFalse(result["allowed"])

        with mock.patch.object(
            participant_event,
            "get_total_monitoring_time",
            return_value=self.event.duration * 60 + 40,
        ):
            result = validate_event_access(participant_event, now)
        self.assertFalse(result["allowed"])
