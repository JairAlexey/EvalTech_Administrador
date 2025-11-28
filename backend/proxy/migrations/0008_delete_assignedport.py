# Remove AssignedPort model completely - not needed anymore
from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('proxy', '0007_remove_monitoring_fields_from_assignedport'),
    ]

    operations = [
        migrations.DeleteModel(
            name='AssignedPort',
        ),
    ]