from django.db import models
from events.models import ParticipantEvent


class AnalisisComportamiento(models.Model):
    STATUS_CHOICES = [
        ("pendiente", "Pendiente"),
        ("procesando", "Procesando"),
        ("completado", "Completado"),
        ("error", "Error"),
    ]

    participant_event = models.OneToOneField(
        ParticipantEvent,
        on_delete=models.CASCADE,
        related_name="analisis_comportamiento",
    )
    video_link = models.CharField(max_length=500)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pendiente")
    fecha_procesamiento = models.DateTimeField(auto_now_add=True)
    class Meta:
        db_table = "analisis_comportamiento"

    def __str__(self):
        return f"Análisis para {self.participant_event}"


class RegistroRostro(models.Model):
    analisis = models.ForeignKey(
        AnalisisComportamiento,
        on_delete=models.CASCADE,
        related_name="registros_rostros",
    )
    persona_id = models.IntegerField()
    tiempo_inicio = models.FloatField()
    tiempo_fin = models.FloatField()

    class Meta:
        db_table = "registro_rostro"


class RegistroGesto(models.Model):
    analisis = models.ForeignKey(
        AnalisisComportamiento,
        on_delete=models.CASCADE,
        related_name="registros_gestos",
    )
    tipo_gesto = models.CharField(max_length=100)  # ej. "Mirando Izquierda"
    tiempo_inicio = models.FloatField()
    tiempo_fin = models.FloatField()
    duracion = models.FloatField()

    class Meta:
        db_table = "registro_gesto"


class RegistroIluminacion(models.Model):
    analisis = models.ForeignKey(
        AnalisisComportamiento,
        on_delete=models.CASCADE,
        related_name="registros_iluminacion",
    )
    tiempo_inicio = models.FloatField()
    tiempo_fin = models.FloatField()

    class Meta:
        db_table = "registro_iluminacion"


class RegistroVoz(models.Model):
    analisis = models.ForeignKey(
        AnalisisComportamiento, on_delete=models.CASCADE, related_name="registros_voz"
    )
    tipo_log = models.CharField(max_length=50)  # 'susurro' o 'intervalo_hablante'
    etiqueta_hablante = models.CharField(
        max_length=50, null=True, blank=True
    )  # ej. "Voz 1"
    tiempo_inicio = models.FloatField()
    tiempo_fin = models.FloatField()

    class Meta:
        db_table = "registro_voz"


class AnomaliaLipsync(models.Model):
    analisis = models.ForeignKey(
        AnalisisComportamiento,
        on_delete=models.CASCADE,
        related_name="anomalias_lipsync",
    )
    tipo_anomalia = models.CharField(max_length=100)
    tiempo_inicio = models.FloatField()
    tiempo_fin = models.FloatField()

    class Meta:
        db_table = "registro_lipsync"


class RegistroAusencia(models.Model):
    analisis = models.ForeignKey(
        AnalisisComportamiento,
        on_delete=models.CASCADE,
        related_name="registros_ausencia",
    )
    tiempo_inicio = models.FloatField()
    tiempo_fin = models.FloatField()
    duracion = models.FloatField()

    class Meta:
        db_table = "registro_ausencia"
