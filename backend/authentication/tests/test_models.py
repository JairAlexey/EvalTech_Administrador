from django.test import TestCase

from authentication.models import CustomUser, UserRole


class AuthenticationModelsTests(TestCase):
    def test_custom_user_password_helpers(self):
        user = CustomUser.objects.create(
            email="model@example.com",
            first_name="Model",
            last_name="User",
            password="plain",
        )

        user.set_password("secret123")
        user.save()

        self.assertTrue(user.check_password("secret123"))
        self.assertFalse(user.check_password("wrong"))

    def test_user_role_str(self):
        user = CustomUser.objects.create(
            email="role@example.com",
            first_name="Role",
            last_name="User",
            password="hashed",
        )
        role = UserRole.objects.create(user=user, role="admin")

        self.assertIn("role@example.com", str(role))
