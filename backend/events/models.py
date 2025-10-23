from django.db import models
import hashlib


# Create your models here.
class Event(models.Model):
    TYPE_CHOICES = [
        ("tecnica", "Evaluación Técnica"),
        ("practica", "Evaluación Práctica"),
        ("teorica", "Evaluación Teórica"),
    ]

    STATUS_CHOICES = [
        ("programado", "Programado"),
        ("en_progreso", "En progreso"),
        ("completado", "Completado"),
        ("cancelado", "Cancelado"),
    ]

    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    start_date = models.DateTimeField(null=True)
    end_date = models.DateTimeField(null=True)
    duration = models.IntegerField(default=60, help_text="Duración en minutos")
    event_type = models.CharField(
        max_length=20, choices=TYPE_CHOICES, default="tecnica"
    )
    evaluator = models.CharField(max_length=200, null=True, blank=True)
    camera_enabled = models.BooleanField(default=True)
    mic_enabled = models.BooleanField(default=True)
    screen_enabled = models.BooleanField(default=True)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="programado"
    )
    code = models.CharField(max_length=20, blank=True, null=True, unique=True)

    class Meta:
        db_table = "eventos"

    def save(self, *args, **kwargs):
        # Generar un código único para el evento si no existe
        if not self.code and self.id:
            self.code = (
                f"EVT-{self.start_date.year}-{self.id:03d}"
                if self.start_date
                else f"EVT-{self.id:03d}"
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name


class Participant(models.Model):
    STATUS_CHOICES = [
        ("activo", "Activo"),
        ("inactivo", "Inactivo"),
        ("pendiente", "Pendiente"),
        ("cancelado", "Cancelado"),
    ]

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    name = models.CharField(max_length=200)  # Nombre completo
    email = models.EmailField()
    position = models.CharField(max_length=100, blank=True, null=True)  # Puesto
    experience_years = models.IntegerField(blank=True, null=True)  # Años de experiencia
    skills = models.TextField(blank=True, null=True)  # Habilidades
    notes = models.TextField(blank=True, null=True)  # Notas adicionales
    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="participants",
        null=True,
        blank=True,
    )
    event_key = models.CharField(max_length=128, blank=True, null=True, unique=True)
    is_active = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default="pendiente"
    )
    send_credentials = models.BooleanField(default=True)
    send_reminder = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    def generate_event_key(self):
        if self.event:
            self.event_key = hashlib.blake2b(
                (str(self.event.id) + self.email).encode(), digest_size=8
            ).hexdigest()
        else:
            # Si no hay evento, generamos una clave usando solo el email
            self.event_key = hashlib.blake2b(
                (self.email + "no_event").encode(), digest_size=8
            ).hexdigest()

    def get_initials(self):
        """Obtener las iniciales del nombre para mostrar en la UI"""
        parts = self.name.split()
        if len(parts) >= 2:
            return f"{parts[0][0]}{parts[-1][0]}".upper()
        elif len(parts) == 1:
            if len(parts[0]) >= 2:
                return parts[0][:2].upper()
            else:
                return parts[0][0].upper()
        return "?"

    class Meta:
        constraints = [
            # Asegura que la combinación de evento y email sea única, solo cuando hay evento
            models.UniqueConstraint(
                fields=["event", "email"],
                name="unique_email_per_event",
                condition=models.Q(event__isnull=False),
            )
        ]

        db_table = "participantes"

    def save(self, *args, **kwargs):
        # Actualizar el nombre completo
        if not self.name:
            self.name = f"{self.first_name} {self.last_name}".strip()
        self.generate_event_key()
        return super().save(*args, **kwargs)


class ParticipantLog(models.Model):
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to="logs", null=True, blank=True)
    message = models.TextField()
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, null=True)

    def __str__(self):
        return self.name


class BlockedHost(models.Model):
    event = models.ForeignKey(
        Event, on_delete=models.CASCADE, related_name="blocked_hosts"
    )
    hostname = models.CharField(max_length=255)

    class Meta:
        db_table = "paginas_bloqueadas"

    def __str__(self):
        return f"{self.hostname} ({self.event.name})"
