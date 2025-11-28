# Generated manually to add monitoring fields to ParticipantEvent
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0006_proxyupdatesignal'),
    ]

    operations = [
        migrations.AddField(
            model_name='participantevent',
            name='monitoring_current_session_time',
            field=models.DateTimeField(blank=True, null=True, help_text="Tiempo de inicio de la sesión de monitoreo actual"),
        ),
        migrations.AddField(
            model_name='participantevent',
            name='monitoring_total_duration',
            field=models.IntegerField(default=0, help_text="Duración total de monitoreo en segundos"),
        ),
        migrations.AddField(
            model_name='participantevent',
            name='monitoring_last_change',
            field=models.DateTimeField(blank=True, null=True, help_text="Momento del último cambio de estado de monitoreo"),
        ),
        migrations.AddField(
            model_name='participantevent',
            name='monitoring_sessions_count',
            field=models.IntegerField(default=0, help_text="Número de veces que se inició el monitoreo"),
        ),
    ]