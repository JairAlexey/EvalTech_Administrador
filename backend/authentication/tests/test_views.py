import json
import hashlib

from django.test import RequestFactory, TestCase
from django.utils import timezone

from authentication.models import CustomUser, UserRole
from authentication.utils import generate_token
from authentication import views
from events.models import Event


class AuthenticationViewsTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.superadmin = CustomUser.objects.create(
            email="super@example.com",
            first_name="Super",
            last_name="Admin",
            password="hashed",
        )
        UserRole.objects.create(user=self.superadmin, role="superadmin")

    def test_login_view_success(self):
        user = CustomUser.objects.create(
            email="login@example.com",
            first_name="Login",
            last_name="User",
            password="plain",
        )
        user.set_password("secret123")
        user.save()

        request = self.factory.post(
            "/auth/login/",
            data=json.dumps({"email": "login@example.com", "password": "secret123"}),
            content_type="application/json",
        )

        response = views.login_view(request)

        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", payload)
        self.assertEqual(payload["user"]["email"], "login@example.com")

    def test_login_view_legacy_sha256(self):
        password = "legacy"
        legacy_hash = hashlib.sha256(password.encode("utf-8")).hexdigest()
        user = CustomUser.objects.create(
            email="legacy@example.com",
            first_name="Legacy",
            last_name="User",
            password=legacy_hash,
        )

        request = self.factory.post(
            "/auth/login/",
            data=json.dumps({"email": "legacy@example.com", "password": password}),
            content_type="application/json",
        )

        response = views.login_view(request)
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.check_password(password))

    def test_login_view_invalid_credentials(self):
        CustomUser.objects.create(
            email="bad@example.com",
            first_name="Bad",
            last_name="User",
            password="hashed",
        )
        request = self.factory.post(
            "/auth/login/",
            data=json.dumps({"email": "bad@example.com", "password": "nope"}),
            content_type="application/json",
        )

        response = views.login_view(request)
        self.assertEqual(response.status_code, 401)

    def test_login_view_user_not_found(self):
        request = self.factory.post(
            "/auth/login/",
            data=json.dumps({"email": "missing@example.com", "password": "nope"}),
            content_type="application/json",
        )

        response = views.login_view(request)
        self.assertEqual(response.status_code, 401)

    def test_login_view_missing_fields(self):
        request = self.factory.post(
            "/auth/login/",
            data=json.dumps({"email": ""}),
            content_type="application/json",
        )

        response = views.login_view(request)
        self.assertEqual(response.status_code, 400)

    def test_login_view_invalid_json(self):
        request = self.factory.post(
            "/auth/login/",
            data="{bad json}",
            content_type="application/json",
        )

        response = views.login_view(request)
        self.assertEqual(response.status_code, 400)

    def test_verify_token_view_missing(self):
        request = self.factory.post(
            "/auth/verify-token/",
            data=json.dumps({}),
            content_type="application/json",
        )

        response = views.verify_token_view(request)
        self.assertEqual(response.status_code, 400)

    def test_verify_token_view_valid(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/verify-token/",
            data=json.dumps({"token": token}),
            content_type="application/json",
        )

        response = views.verify_token_view(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["valid"])

    def test_verify_token_user_not_found(self):
        temp_user = CustomUser.objects.create(
            email="temp@example.com",
            first_name="Temp",
            last_name="User",
            password="hashed",
        )
        token = generate_token(temp_user)
        temp_user.delete()

        request = self.factory.post(
            "/auth/verify-token/",
            data=json.dumps({"token": token}),
            content_type="application/json",
        )

        response = views.verify_token_view(request)
        self.assertEqual(response.status_code, 401)

    def test_verify_token_view_invalid_json(self):
        request = self.factory.post(
            "/auth/verify-token/",
            data="{bad json}",
            content_type="application/json",
        )

        response = views.verify_token_view(request)
        self.assertEqual(response.status_code, 400)

    def test_user_info_view(self):
        token = generate_token(self.superadmin)
        request = self.factory.get(
            "/auth/user-info/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )

        response = views.user_info_view(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload["email"], "super@example.com")

    def test_create_user_view_success(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/create-user/",
            data=json.dumps(
                {
                    "email": "new@example.com",
                    "password": "1234",
                    "firstName": "New",
                    "lastName": "User",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.create_user_view(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 201)
        self.assertTrue(payload["success"])

    def test_create_user_view_invalid_role(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/create-user/",
            data=json.dumps(
                {
                    "email": "role@example.com",
                    "password": "1234",
                    "firstName": "Role",
                    "lastName": "User",
                    "role": "viewer",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.create_user_view(request)
        self.assertEqual(response.status_code, 400)

    def test_create_user_view_missing_field(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/create-user/",
            data=json.dumps(
                {
                    "email": "missing@example.com",
                    "password": "1234",
                    "firstName": "",
                    "lastName": "User",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.create_user_view(request)
        self.assertEqual(response.status_code, 400)

    def test_create_user_view_invalid_email(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/create-user/",
            data=json.dumps(
                {
                    "email": "bad-email",
                    "password": "1234",
                    "firstName": "Bad",
                    "lastName": "Email",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.create_user_view(request)
        self.assertEqual(response.status_code, 400)

    def test_create_user_view_short_password(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/create-user/",
            data=json.dumps(
                {
                    "email": "short@example.com",
                    "password": "123",
                    "firstName": "Short",
                    "lastName": "Pass",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.create_user_view(request)
        self.assertEqual(response.status_code, 400)

    def test_create_user_view_existing_email(self):
        CustomUser.objects.create(
            email="exists@example.com",
            first_name="Exists",
            last_name="User",
            password="hashed",
        )
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/create-user/",
            data=json.dumps(
                {
                    "email": "exists@example.com",
                    "password": "1234",
                    "firstName": "Exists",
                    "lastName": "User",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.create_user_view(request)
        self.assertEqual(response.status_code, 400)

    def test_delete_user_view_self_forbidden(self):
        token = generate_token(self.superadmin)
        request = self.factory.delete(
            f"/auth/delete-user/{self.superadmin.id}/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.delete_user_view(request, self.superadmin.id)
        self.assertEqual(response.status_code, 400)

    def test_delete_user_view_not_found(self):
        token = generate_token(self.superadmin)
        request = self.factory.delete(
            "/auth/delete-user/999/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.delete_user_view(request, 999)
        self.assertEqual(response.status_code, 404)

    def test_delete_user_view_restricted(self):
        evaluator = CustomUser.objects.create(
            email="restricted@example.com",
            first_name="Restricted",
            last_name="User",
            password="hashed",
        )
        UserRole.objects.create(user=evaluator, role="evaluator")
        now = timezone.now()
        Event.objects.create(
            name="Restricted Event",
            description="Restricted",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=15,
            evaluator=evaluator,
            status="programado",
        )
        token = generate_token(self.superadmin)
        request = self.factory.delete(
            f"/auth/delete-user/{evaluator.id}/",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.delete_user_view(request, evaluator.id)
        self.assertEqual(response.status_code, 400)

    def test_edit_user_view_superadmin_forbidden(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            f"/auth/edit-user/{self.superadmin.id}/",
            data=json.dumps(
                {
                    "email": "super@example.com",
                    "firstName": "Super",
                    "lastName": "Admin",
                    "password": "",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.edit_user_view(request, self.superadmin.id)
        self.assertEqual(response.status_code, 400)

    def test_edit_user_view_invalid_role(self):
        user = CustomUser.objects.create(
            email="editrole@example.com",
            first_name="Edit",
            last_name="Role",
            password="hashed",
        )
        UserRole.objects.create(user=user, role="admin")
        token = generate_token(self.superadmin)
        request = self.factory.post(
            f"/auth/edit-user/{user.id}/",
            data=json.dumps(
                {
                    "email": "editrole@example.com",
                    "firstName": "Edit",
                    "lastName": "Role",
                    "password": "",
                    "role": "viewer",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.edit_user_view(request, user.id)
        self.assertEqual(response.status_code, 400)

    def test_edit_user_view_duplicate_email(self):
        user = CustomUser.objects.create(
            email="editdup@example.com",
            first_name="Edit",
            last_name="Dup",
            password="hashed",
        )
        CustomUser.objects.create(
            email="other@example.com",
            first_name="Other",
            last_name="User",
            password="hashed",
        )
        UserRole.objects.create(user=user, role="admin")
        token = generate_token(self.superadmin)
        request = self.factory.post(
            f"/auth/edit-user/{user.id}/",
            data=json.dumps(
                {
                    "email": "other@example.com",
                    "firstName": "Edit",
                    "lastName": "Dup",
                    "password": "",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.edit_user_view(request, user.id)
        self.assertEqual(response.status_code, 400)

    def test_edit_user_view_success(self):
        user = CustomUser.objects.create(
            email="editok@example.com",
            first_name="Edit",
            last_name="Ok",
            password="hashed",
        )
        UserRole.objects.create(user=user, role="admin")
        token = generate_token(self.superadmin)
        request = self.factory.post(
            f"/auth/edit-user/{user.id}/",
            data=json.dumps(
                {
                    "email": "editok@example.com",
                    "firstName": "Edited",
                    "lastName": "User",
                    "password": "",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.edit_user_view(request, user.id)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["success"])

    def test_edit_user_view_role_missing_creates(self):
        user = CustomUser.objects.create(
            email="editnorole@example.com",
            first_name="Edit",
            last_name="NoRole",
            password="hashed",
        )
        token = generate_token(self.superadmin)
        request = self.factory.post(
            f"/auth/edit-user/{user.id}/",
            data=json.dumps(
                {
                    "email": "editnorole@example.com",
                    "firstName": "Edit",
                    "lastName": "NoRole",
                    "password": "",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.edit_user_view(request, user.id)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(UserRole.objects.filter(user=user, role="admin").exists())

    def test_edit_user_view_evaluator_with_events_role_change(self):
        evaluator = CustomUser.objects.create(
            email="evaledit@example.com",
            first_name="Eval",
            last_name="Edit",
            password="hashed",
        )
        UserRole.objects.create(user=evaluator, role="evaluator")
        now = timezone.now()
        Event.objects.create(
            name="Eval Edit Event",
            description="Eval",
            start_date=now,
            close_date=now,
            end_date=now,
            duration=15,
            evaluator=evaluator,
            status="programado",
        )
        token = generate_token(self.superadmin)
        request = self.factory.post(
            f"/auth/edit-user/{evaluator.id}/",
            data=json.dumps(
                {
                    "email": "evaledit@example.com",
                    "firstName": "Eval",
                    "lastName": "Edit",
                    "password": "",
                    "role": "admin",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.edit_user_view(request, evaluator.id)
        self.assertEqual(response.status_code, 400)

    def test_update_profile_view_success(self):
        token = generate_token(self.superadmin)
        self.superadmin.set_password("oldpass")
        self.superadmin.save()

        request = self.factory.post(
            "/auth/update-profile/",
            data=json.dumps(
                {
                    "email": "super@example.com",
                    "firstName": "Super",
                    "lastName": "Admin",
                    "currentPassword": "oldpass",
                    "newPassword": "newpass",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.update_profile_view(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["success"])

    def test_update_profile_missing_fields(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/update-profile/",
            data=json.dumps({"email": "", "firstName": "", "lastName": ""}),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.update_profile_view(request)
        self.assertEqual(response.status_code, 400)

    def test_update_profile_invalid_email(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/update-profile/",
            data=json.dumps(
                {"email": "bad-email", "firstName": "A", "lastName": "B"}
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.update_profile_view(request)
        self.assertEqual(response.status_code, 400)

    def test_update_profile_new_password_missing_current(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/update-profile/",
            data=json.dumps(
                {
                    "email": "super@example.com",
                    "firstName": "Super",
                    "lastName": "Admin",
                    "newPassword": "newpass",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.update_profile_view(request)
        self.assertEqual(response.status_code, 400)

    def test_update_profile_current_password_wrong(self):
        token = generate_token(self.superadmin)
        self.superadmin.set_password("rightpass")
        self.superadmin.save()
        request = self.factory.post(
            "/auth/update-profile/",
            data=json.dumps(
                {
                    "email": "super@example.com",
                    "firstName": "Super",
                    "lastName": "Admin",
                    "currentPassword": "wrong",
                    "newPassword": "newpass",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.update_profile_view(request)
        self.assertEqual(response.status_code, 400)

    def test_update_profile_new_password_short(self):
        token = generate_token(self.superadmin)
        self.superadmin.set_password("rightpass")
        self.superadmin.save()
        request = self.factory.post(
            "/auth/update-profile/",
            data=json.dumps(
                {
                    "email": "super@example.com",
                    "firstName": "Super",
                    "lastName": "Admin",
                    "currentPassword": "rightpass",
                    "newPassword": "123",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.update_profile_view(request)
        self.assertEqual(response.status_code, 400)

    def test_update_profile_new_password_same(self):
        token = generate_token(self.superadmin)
        self.superadmin.set_password("samepass")
        self.superadmin.save()
        request = self.factory.post(
            "/auth/update-profile/",
            data=json.dumps(
                {
                    "email": "super@example.com",
                    "firstName": "Super",
                    "lastName": "Admin",
                    "currentPassword": "samepass",
                    "newPassword": "samepass",
                }
            ),
            content_type="application/json",
            HTTP_AUTHORIZATION=f"Bearer {token}",
        )

        response = views.update_profile_view(request)
        self.assertEqual(response.status_code, 400)
    def test_refresh_token_view_invalid(self):
        request = self.factory.post(
            "/auth/refresh-token/",
            data=json.dumps({"token": "invalid"}),
            content_type="application/json",
        )

        response = views.refresh_token_view(request)
        self.assertEqual(response.status_code, 401)

    def test_refresh_token_view_valid(self):
        token = generate_token(self.superadmin)
        request = self.factory.post(
            "/auth/refresh-token/",
            data=json.dumps({"token": token}),
            content_type="application/json",
        )

        response = views.refresh_token_view(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 200)
        self.assertIn("token", payload)

    def test_refresh_token_view_missing_token(self):
        request = self.factory.post(
            "/auth/refresh-token/",
            data=json.dumps({}),
            content_type="application/json",
        )

        response = views.refresh_token_view(request)
        self.assertEqual(response.status_code, 400)

    def test_refresh_token_view_user_not_found(self):
        temp_user = CustomUser.objects.create(
            email="refreshmissing@example.com",
            first_name="Refresh",
            last_name="Missing",
            password="hashed",
        )
        token = generate_token(temp_user)
        temp_user.delete()

        request = self.factory.post(
            "/auth/refresh-token/",
            data=json.dumps({"token": token}),
            content_type="application/json",
        )

        response = views.refresh_token_view(request)
        self.assertEqual(response.status_code, 404)

    def test_refresh_token_view_invalid_json(self):
        request = self.factory.post(
            "/auth/refresh-token/",
            data="{bad json}",
            content_type="application/json",
        )

        response = views.refresh_token_view(request)
        self.assertEqual(response.status_code, 400)

    def test_role_management_view(self):
        token = generate_token(self.superadmin)
        request = self.factory.get(
            "/auth/roles/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )

        response = views.role_management_view(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertIn("users", payload)

    def test_evaluator_users(self):
        evaluator = CustomUser.objects.create(
            email="evaluator@example.com",
            first_name="Eval",
            last_name="User",
            password="hashed",
        )
        UserRole.objects.create(user=evaluator, role="evaluator")
        token = generate_token(self.superadmin)
        request = self.factory.get(
            "/auth/users/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )

        response = views.evaluator_users(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertTrue(payload["users"])
