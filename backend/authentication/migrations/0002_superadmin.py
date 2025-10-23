from django.db import migrations
from django.contrib.auth.hashers import make_password
import os


def create_superadmin(apps, schema_editor):
    CustomUser = apps.get_model("authentication", "CustomUser")
    UserRole = apps.get_model("authentication", "UserRole")

    default_pwd = os.environ.get("SUPERADMIN_PASSWORD", "admin123")

    user, created = CustomUser.objects.get_or_create(
        email="superadmin@iqlatam.com",
        defaults={
            "first_name": "Super",
            "last_name": "Admin",
            "password": make_password(default_pwd),
        },
    )
    UserRole.objects.get_or_create(user=user, defaults={"role": "superadmin"})


class Migration(migrations.Migration):

    dependencies = [
        ("authentication", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_superadmin),
    ]
