from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('events', '0004_remove_participantlog_participant_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='participantevent',
            name='is_monitoring',
            field=models.BooleanField(default=False),
        ),
    ]
