# Remove monitoring fields from AssignedPort - moved to ParticipantEvent
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('proxy', '0006_assignedport_first_connection_time_and_more'),
        ('events', '0007_add_monitoring_fields_to_participantevent'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='assignedport',
            name='current_session_time',
        ),
        migrations.RemoveField(
            model_name='assignedport',
            name='total_duration',
        ),
        migrations.RemoveField(
            model_name='assignedport',
            name='monitoring_last_change',
        ),
        migrations.RemoveField(
            model_name='assignedport',
            name='monitoring_sessions_count',
        ),
    ]