from django.db import migrations


def forwards(apps, schema_editor):
    Analisis = apps.get_model("behavior_analysis", "AnalisisComportamiento")
    mapping = {
        "PENDING": "pendiente",
        "PROCESSING": "procesando",
        "COMPLETED": "completado",
        "ERROR": "error",
    }
    for old, new in mapping.items():
        Analisis.objects.filter(status=old).update(status=new)


def backwards(apps, schema_editor):
    Analisis = apps.get_model("behavior_analysis", "AnalisisComportamiento")
    mapping = {
        "pendiente": "PENDING",
        "procesando": "PROCESSING",
        "completado": "COMPLETED",
        "error": "ERROR",
    }
    for old, new in mapping.items():
        Analisis.objects.filter(status=old).update(status=new)


class Migration(migrations.Migration):

    dependencies = [
        ("behavior_analysis", "0008_alter_analisiscomportamiento_status"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
