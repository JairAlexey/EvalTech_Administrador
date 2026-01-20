from django.db import models
from django.contrib.auth.hashers import (
    make_password,
    check_password as django_check_password,
)


class CustomUser(models.Model):
    email = models.EmailField(unique=True)
    first_name = models.CharField(max_length=150)
    last_name = models.CharField(max_length=150)
    password = models.CharField(max_length=128)
    date_joined = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "usuarios"

    def __str__(self):
        return self.email

    # Métodos para trabajar con contraseñas usando los hashers de Django
    def set_password(self, raw_password: str):
        self.password = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        return django_check_password(raw_password, self.password)


class UserRole(models.Model):
    ROLE_CHOICES = [
        ("superadmin", "Super Administrador"),
        ("admin", "Administrador"),
        ("evaluator", "Evaluador"),
    ]

    # Eliminar en cascada el rol, cuando un usuario sea eliminado
    user = models.OneToOneField(
        CustomUser, on_delete=models.CASCADE, related_name="user_role"
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "roles_usuarios"

    def __str__(self):
        return f"{self.user.email} - {self.get_role_display()}"
