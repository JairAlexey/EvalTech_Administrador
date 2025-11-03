from uuid import uuid4
from django.db import models
from events.models import Participant


def generate_session_key():
    return str(uuid4())


class AssignedPort(models.Model):
    participant_event = models.OneToOneField(
        "events.ParticipantEvent",
        on_delete=models.CASCADE,
        related_name="assigned_port",
    )
    port = models.IntegerField(unique=True)
    is_active = models.BooleanField(default=True)

    # Tiempo acumulado de conexión en segundos
    total_duration = models.IntegerField(
        default=0, help_text="Duración total en segundos"
    )

    # Para calcular la sesión actual
    current_session_time = models.DateTimeField(null=True, blank=True)

    last_activity = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "puertos_asignados"

    def start_session(self):
        """Inicia una nueva sesión de conexión"""
        from django.utils import timezone

        self.current_session_time = timezone.now()
        self.is_active = True
        self.save()

    def end_session(self):
        """Termina la sesión actual y acumula el tiempo"""
        if self.current_session_time:
            from django.utils import timezone

            session_duration = (
                timezone.now() - self.current_session_time
            ).total_seconds()
            self.total_duration += int(session_duration)
            self.current_session_time = None
        self.is_active = False
        self.save()
