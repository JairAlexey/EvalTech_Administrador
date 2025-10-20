from django.db import migrations
from django.contrib.auth.hashers import make_password


def create_superadmin(apps, schema_editor):
    User = apps.get_model("auth", "User")
    UserRole = apps.get_model("authentication", "UserRole")
    # Crea el usuario si no existe
    user, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "is_superuser": True,
            "is_staff": True,
            "email": "admin@example.com",
            "password": make_password("admin123"),
        },
    )
    # Crea el rol
    UserRole.objects.get_or_create(user=user, defaults={"role": "superadmin"})


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_superadmin),
    ]
