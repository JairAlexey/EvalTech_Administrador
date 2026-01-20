import json

from django.http import JsonResponse
from django.test import RequestFactory, TestCase

from authentication.models import CustomUser, UserRole
from authentication.utils import generate_token, get_user_data, jwt_required, verify_token


class AuthUtilsTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create(
            email="user@example.com",
            first_name="User",
            last_name="Example",
            password="hashed",
        )

    def test_generate_and_verify_token(self):
        token = generate_token(self.user)
        payload = verify_token(token)

        self.assertIsNotNone(payload)
        self.assertEqual(payload["user_id"], self.user.id)

    def test_get_user_data_without_role(self):
        data = get_user_data(self.user)
        self.assertEqual(data["email"], "user@example.com")
        self.assertEqual(data["role"], "sin_rol")

    def test_jwt_required_rejects_missing_auth(self):
        @jwt_required()
        def view(request):
            return JsonResponse({"ok": True})

        request = RequestFactory().get("/auth/user-info/")
        response = view(request)

        self.assertEqual(response.status_code, 401)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertIn("error", payload)

    def test_jwt_required_accepts_valid_token(self):
        @jwt_required()
        def view(request):
            return JsonResponse({"ok": True})

        token = generate_token(self.user)
        request = RequestFactory().get(
            "/auth/user-info/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        response = view(request)

        self.assertEqual(response.status_code, 200)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(payload.get("ok"), True)

    def test_jwt_required_role_forbidden(self):
        user = CustomUser.objects.create(
            email="rolecheck@example.com",
            first_name="Role",
            last_name="Check",
            password="hashed",
        )
        UserRole.objects.create(user=user, role="admin")
        token = generate_token(user)

        @jwt_required(roles=["superadmin"])
        def view(request):
            return JsonResponse({"ok": True})

        request = RequestFactory().get(
            "/auth/roles/", HTTP_AUTHORIZATION=f"Bearer {token}"
        )
        response = view(request)

        self.assertEqual(response.status_code, 403)
