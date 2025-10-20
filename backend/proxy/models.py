# proxy/models.py
from uuid import uuid4
from django.db import models
from events.models import Participant


def generate_session_key():
    return str(uuid4())


class AssignedPort(models.Model):
    participant = models.OneToOneField(
        Participant, on_delete=models.CASCADE, related_name="assigned_port"
    )
    port = models.IntegerField(unique=True)
    is_active = models.BooleanField(default=True)
    last_activity = models.DateTimeField(auto_now=True)
    session_key = models.CharField(
        max_length=40, unique=True, default=generate_session_key
    )

    def get_event_key(self):
        return self.participant.event_key

    class Meta:
        indexes = [
            models.Index(fields=["port"]),
            models.Index(fields=["is_active"]),
        ]

        db_table = "puertos_asignados"
