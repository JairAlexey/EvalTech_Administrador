from django.db import models
from django.contrib.auth.models import User


class UserRole(models.Model):
    ROLE_CHOICES = [
        ("superadmin", "Super Administrador"),
        ("admin", "Administrador"),
        ("evaluator", "Evaluador"),
    ]

    user = models.OneToOneField(
        User, on_delete=models.CASCADE, related_name="user_role"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "roles_usuarios"

    def __str__(self):
        return f"{self.user.username} - {self.get_role_display()}"
