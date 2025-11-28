from django.db import models
import hashlib
from authentication.models import CustomUser


class Event(models.Model):

    STATUS_CHOICES = [
        ("programado", "Programado"),
        ("en_progreso", "En progreso"),
        ("completado", "Completado"),
    ]

    name = models.CharField(max_length=200, unique=True)
    description = models.TextField()
    start_date = models.DateTimeField()
    close_date = models.DateTimeField()
    duration = models.IntegerField(help_text="Duración en minutos")
    end_date = models.DateTimeField()
    evaluator = models.ForeignKey(
        CustomUser, on_delete=models.RESTRICT, related_name="events_as_evaluator"
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES)

    class Meta:
        db_table = "eventos"

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Participant(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    name = models.CharField(max_length=200)
    email = models.EmailField(unique=True)
    events = models.ManyToManyField(
        Event, through="ParticipantEvent", related_name="participants", blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        db_table = "participantes"

    def get_initials(self):
        # Usa first_name y last_name si existen, si no, usa name
        if hasattr(self, "first_name") and hasattr(self, "last_name"):
            initials = (self.first_name[:1] + self.last_name[:1]).upper()
        elif hasattr(self, "name"):
            parts = self.name.split()
            initials = "".join([p[0] for p in parts[:2]]).upper()
        else:
            initials = ""
        return initials

    def save(self, *args, **kwargs):
        if not self.name:
            self.name = f"{self.first_name} {self.last_name}".strip()
        return super().save(*args, **kwargs)


class ParticipantEvent(models.Model):
    # Participante no se puede eliminar si tiene eventos asociados
    participant = models.ForeignKey(
        Participant, on_delete=models.RESTRICT, related_name="participant_events"
    )

    # Evento se elimina en cascada aunque tenga participantes asociados
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="participant_events"
    )
    event_key = models.CharField(max_length=128, blank=True, null=True, unique=True)
    # Indica si el participante pulsó "Empezar monitoreo" y por tanto las capturas/logs
    # deben contarse y mostrarse como activo
    is_monitoring = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    # Campos de monitoreo (separados del proxy connection)
    monitoring_current_session_time = models.DateTimeField(blank=True, null=True, help_text="Tiempo de inicio de la sesión de monitoreo actual")
    monitoring_total_duration = models.IntegerField(default=0, help_text="Duración total de monitoreo en segundos")
    monitoring_last_change = models.DateTimeField(blank=True, null=True, help_text="Momento del último cambio de estado de monitoreo")
    monitoring_sessions_count = models.IntegerField(default=0, help_text="Número de veces que se inició el monitoreo")

    class Meta:
        db_table = "eventos_participantes"
        constraints = [
            models.UniqueConstraint(
                fields=["event", "participant"], name="unique_participant_per_event"
            )
        ]

    def generate_event_key(self):
        self.event_key = hashlib.blake2b(
            (str(self.event.id) + self.participant.email).encode(), digest_size=8
        ).hexdigest()

    def save(self, *args, **kwargs):
        self.generate_event_key()
        return super().save(*args, **kwargs)

    def get_total_monitoring_time(self):
        """Retorna el tiempo total de monitoreo en minutos, incluyendo sesión actual si está activa"""
        from django.utils import timezone
        
        # Convertir total_duration de segundos a minutos
        total_minutes = (self.monitoring_total_duration or 0) // 60

        # Incluir la sesión en curso SOLO si está en modo monitoreo
        if self.is_monitoring and self.monitoring_current_session_time:
            try:
                current_seconds = int((timezone.now() - self.monitoring_current_session_time).total_seconds())
                current_minutes = current_seconds // 60
                total_minutes += current_minutes
            except Exception:
                # En caso de error, no sumar tiempo adicional
                pass

        return total_minutes

    def has_monitoring_time_remaining(self):
        """Verifica si aún hay tiempo disponible para monitoreo según la duración del evento"""
        total_minutes = self.get_total_monitoring_time()
        return total_minutes < self.event.duration

    def get_remaining_monitoring_time(self):
        """Obtiene el tiempo restante de monitoreo en minutos"""
        total_minutes = self.get_total_monitoring_time()
        event_duration = self.event.duration
        return max(0, event_duration - total_minutes)

    def __str__(self):
        return f"{self.participant.name} - {self.event.name}"


class ParticipantLog(models.Model):
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to="logs", null=True, blank=True)
    message = models.TextField()
    participant_event = models.ForeignKey(
        ParticipantEvent, on_delete=models.CASCADE, null=True
    )

    class Meta:
        db_table = "logs_participantes"

    def __str__(self):
        return self.name


class Website(models.Model):
    hostname = models.CharField(max_length=255, unique=True)

    class Meta:
        db_table = "paginas"

    def __str__(self):
        return self.hostname


class BlockedHost(models.Model):

    # Cuando un evento se elimina los sitios bloqueados asociados tambien lo hacen
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="blocked_hosts"
    )

    # Una pagina no se puede eliminar si esta asociado a eventos
    website = models.ForeignKey(
        Website, on_delete=models.RESTRICT, related_name="blocked_in_events"
    )

    class Meta:
        db_table = "paginas_bloqueadas"
        unique_together = ("event", "website")

    def __str__(self):
        return f"{self.website.hostname} ({self.event.name})"


# ProxyUpdateSignal model removed - no longer needed with direct HTTP architecture
