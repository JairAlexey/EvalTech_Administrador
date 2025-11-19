from uuid import uuid4
from django.db import models
from events.models import Participant
import logging
import traceback


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

    # Duración total de conexión en segundos
    total_duration = models.IntegerField(
        default=0, help_text="Duración total en segundos", null=True, blank=True
    )
    current_session_time = models.DateTimeField(null=True, blank=True)
    # Momento del último cambio de estado de monitoreo (start/stop)
    monitoring_last_change = models.DateTimeField(null=True, blank=True)
    # Contador de veces que se inició monitoreo
    monitoring_sessions_count = models.IntegerField(default=0, help_text="Número de veces que se inició monitoreo")
    # Primera conexión al evento (para validaciones)
    first_connection_time = models.DateTimeField(null=True, blank=True)
    last_activity = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "puertos_asignados"

    def activate(self):
        """Activa el puerto y registra el tiempo de inicio"""
        from django.utils import timezone
        # Activar proxy/puerto, pero NO iniciar el contador de monitoreo aquí.
        # El contador de monitoreo debe iniciarse únicamente cuando el participante
        # pulsa "Empezar monitoreo" (participant_event.is_monitoring = True).
        self.is_active = True
        self.save(update_fields=['is_active'])
        logger = logging.getLogger(__name__)
        logger.debug(f"Port {self.port} activated (proxy connection) at {timezone.now()}")

    def deactivate(self):
        """Desactiva el puerto (NO sumar duración aquí)."""
        from django.db import transaction
        logger = logging.getLogger(__name__)

        # Hacer la operación idempotente y protegida contra concurrencia
        with transaction.atomic():
            ap = AssignedPort.objects.select_for_update().get(pk=self.pk)
            if not ap.is_active:
                logger.debug(f"AssignedPort.deactivate called but port {ap.port} already inactive")
                return

            # Registrar stack trace ligero para ayudar a identificar quién llama deactivate
            try:
                stack = ''.join(traceback.format_stack(limit=5))
                logger.info(f"AssignedPort.deactivate called for port={ap.port}\nCaller stack (truncated):\n{stack}")
            except Exception:
                logger.debug("AssignedPort.deactivate: could not capture stack")

            # No sumar duración aquí: solo marcar como inactivo y limpiar current_session_time
            ap.is_active = False
            ap.current_session_time = None
            ap.save(update_fields=['is_active', 'current_session_time'])

    def get_total_time(self):
        """Retorna el tiempo total en minutos, incluyendo el tiempo actual si está activo"""
        from django.utils import timezone
        # Convertir total_duration de segundos a minutos
        total_minutes = (self.total_duration or 0) // 60

        # Incluir la sesión en curso SOLO si el participante está en modo monitoreo
        try:
            if getattr(self.participant_event, 'is_monitoring', False) and self.current_session_time:
                current_seconds = int((timezone.now() - self.current_session_time).total_seconds())
                current_minutes = current_seconds // 60
                total_minutes += current_minutes
        except Exception:
            # En caso de error, no sumar tiempo adicional
            pass

        return total_minutes

    def has_time_remaining(self):
        """Verifica si aún hay tiempo disponible según la duración del evento"""
        total_minutes = self.get_total_time()
        return total_minutes < self.participant_event.event.duration

    def get_remaining_time(self):
        """Obtiene el tiempo restante en minutos"""
        total_minutes = self.get_total_time()
        event_duration = self.participant_event.event.duration
        return max(0, event_duration - total_minutes)
