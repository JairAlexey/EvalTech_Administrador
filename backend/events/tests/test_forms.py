from django.test import TestCase
from django.utils import timezone

from authentication.models import CustomUser
from events.forms import EventForm, ParticipantForm, ParticipantLogForm
from events.models import Event, Participant, ParticipantLog


class EventsFormsTests(TestCase):
    def test_event_form_valid(self):
        evaluator = CustomUser.objects.create(
            email="form@example.com",
            first_name="Form",
            last_name="User",
            password="hashed",
        )
        data = {
            "name": "Form Event",
            "description": "Form Desc",
            "start_date": timezone.now(),
            "close_date": timezone.now(),
            "end_date": timezone.now(),
            "duration": 20,
            "evaluator": evaluator.id,
            "status": "programado",
        }
        form = EventForm(data=data)
        self.assertTrue(form.is_valid())

    def test_participant_form_valid(self):
        form = ParticipantForm(
            data={
                "first_name": "Form",
                "last_name": "Participant",
                "name": "Form Participant",
                "email": "formp@example.com",
            }
        )
        self.assertTrue(form.is_valid())

    def test_participant_log_form_valid(self):
        evaluator = CustomUser.objects.create(
            email="logform@example.com",
            first_name="Form",
            last_name="User",
            password="hashed",
        )
        event = Event.objects.create(
            name="Form Log Event",
            description="Form",
            start_date=timezone.now(),
            close_date=timezone.now(),
            end_date=timezone.now(),
            duration=10,
            evaluator=evaluator,
            status="programado",
        )
        participant = Participant.objects.create(
            first_name="Form",
            last_name="Participant",
            name="Form Participant",
            email="formlog@example.com",
        )
        participant_event = event.participant_events.create(participant=participant)
        form = ParticipantLogForm(
            data={
                "name": "http",
                "message": "test",
                "participant_event": participant_event.id,
            }
        )
        self.assertTrue(form.is_valid())
