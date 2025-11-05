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

    # Duración total de conexión en segundos
    total_duration = models.IntegerField(
        default=0, help_text="Duración total en segundos", null=True, blank=True
    )
    current_session_time = models.DateTimeField(null=True, blank=True)
    last_activity = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "puertos_asignados"

    def activate(self):
        """Activa el puerto y registra el tiempo de inicio"""
        from django.utils import timezone
        self.is_active = True
        self.current_session_time = timezone.now()
        self.save(update_fields=['is_active', 'current_session_time'])
        print(f"[DEBUG] Port {self.port} activated at {self.current_session_time}")

    def deactivate(self):
        """Desactiva el puerto y actualiza el tiempo de conexión"""
        from django.utils import timezone
        if self.is_active:
            now = timezone.now()
            
            # Usar current_session_time si está disponible, sino last_activity
            start_time = self.current_session_time if self.current_session_time else self.last_activity
            
            if start_time:
                # Calcular tiempo de sesión en segundos
                session_duration_seconds = int((now - start_time).total_seconds())
                
                # Actualizar total_duration (en segundos)
                if self.total_duration is None:
                    self.total_duration = 0
                self.total_duration += session_duration_seconds
                
                print(f"[DEBUG] Session duration: {session_duration_seconds} seconds")
                print(f"[DEBUG] Total duration: {self.total_duration} seconds")
            
            # Desactivar y limpiar
            self.is_active = False
            self.current_session_time = None
            self.save(update_fields=['total_duration', 'is_active', 'current_session_time'])

    def get_total_time(self):
        """Retorna el tiempo total en minutos, incluyendo el tiempo actual si está activo"""
        from django.utils import timezone
        
        # Convertir total_duration de segundos a minutos
        total_minutes = (self.total_duration or 0) // 60
        
        # Si está activo, agregar el tiempo de la sesión actual
        if self.is_active and self.current_session_time:
            current_seconds = int((timezone.now() - self.current_session_time).total_seconds())
            current_minutes = current_seconds // 60
            total_minutes += current_minutes
        
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
