import json
import os
from datetime import timedelta

from dotenv import load_dotenv
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connections
from django.utils import timezone

from authentication.models import CustomUser
from events.models import Event, Participant, ParticipantEvent


def _build_database_config():
    host_default = "host.docker.internal" if os.getenv("DOCKER_ENV") else "localhost"
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "railway"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", host_default),
        "PORT": os.getenv("DB_PORT", "5432"),
    }


def _apply_env_file(env_file: str | None) -> None:
    if not env_file:
        return
    env_path = os.path.abspath(env_file)
    if not os.path.exists(env_path):
        raise CommandError(f"Env file not found: {env_path}")

    load_dotenv(env_path, override=True)
    settings.DATABASES["default"] = _build_database_config()
    connections.databases = settings.DATABASES
    connections.close_all()


class Command(BaseCommand):
    help = "Prepare an event and participants for local load testing."

    def add_arguments(self, parser):
        parser.add_argument("--count", type=int, default=50)
        parser.add_argument("--event-name", default="Load Test Event")
        parser.add_argument("--duration-minutes", type=int, default=120)
        parser.add_argument("--output", default=None)
        parser.add_argument("--env-file", default=None)

    def handle(self, *args, **options):
        _apply_env_file(options.get("env_file"))

        count = max(1, int(options["count"]))
        event_name = options["event_name"]
        duration_minutes = max(1, int(options["duration_minutes"]))

        evaluator, created = CustomUser.objects.get_or_create(
            email="loadtest@example.com",
            defaults={
                "first_name": "Load",
                "last_name": "Test",
                "password": "",
            },
        )
        if created:
            evaluator.set_password("loadtest")
            evaluator.save(update_fields=["password"])

        now = timezone.now()
        event_defaults = {
            "description": "Local load test event",
            "start_date": now - timedelta(minutes=5),
            "close_date": now + timedelta(hours=2),
            "end_date": now + timedelta(hours=2),
            "duration": duration_minutes,
            "evaluator": evaluator,
            "status": "en_progreso",
        }
        event, created = Event.objects.get_or_create(
            name=event_name, defaults=event_defaults
        )
        if not created:
            for key, value in event_defaults.items():
                setattr(event, key, value)
            event.save()

        existing_participants = list(Participant.objects.order_by("id")[:count])
        missing = count - len(existing_participants)

        if missing > 0:
            next_index = Participant.objects.count() + 1
            for i in range(missing):
                idx = next_index + i
                existing_participants.append(
                    Participant.objects.create(
                        first_name=f"Load{idx}",
                        last_name="User",
                        name=f"Load {idx} User",
                        email=f"loadtest+{idx}@example.com",
                    )
                )

        participant_events = []
        for participant in existing_participants[:count]:
            pe, _ = ParticipantEvent.objects.get_or_create(
                event=event, participant=participant
            )
            participant_events.append(pe)

        event_keys = [pe.event_key for pe in participant_events]

        output_path = options["output"]
        if not output_path:
            output_path = os.path.join(
                settings.BASE_DIR,
                "..",
                "..",
                "Aplicacion Monitoreo",
                "load_tests",
                "event_keys.json",
            )
        output_path = os.path.abspath(output_path)
        os.makedirs(os.path.dirname(output_path), exist_ok=True)

        payload = {
            "event_id": event.id,
            "event_name": event.name,
            "count": len(event_keys),
            "event_keys": event_keys,
            "participants": [
                {"id": pe.participant.id, "email": pe.participant.email}
                for pe in participant_events
            ],
        }

        with open(output_path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)

        self.stdout.write(
            self.style.SUCCESS(
                f"Prepared event {event.id} with {len(event_keys)} participants."
            )
        )
        self.stdout.write(f"Wrote event keys to: {output_path}")
