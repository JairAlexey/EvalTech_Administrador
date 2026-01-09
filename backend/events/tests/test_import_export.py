import json
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import RequestFactory, TestCase

from openpyxl import Workbook

from authentication.models import CustomUser, UserRole
from authentication.utils import generate_token
from events.models import Participant
from events import views


class EventsImportExportTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.admin = CustomUser.objects.create(
            email="import@example.com",
            first_name="Import",
            last_name="User",
            password="hashed",
        )
        UserRole.objects.create(user=self.admin, role="admin")
        self.token = generate_token(self.admin)

    def _auth_headers(self):
        return {"HTTP_AUTHORIZATION": f"Bearer {self.token}"}

    def _make_workbook_bytes(self, rows):
        wb = Workbook()
        ws = wb.active
        ws.append(["ID", "Nombre", "Apellidos", "Email"])
        for row in rows:
            ws.append(row)
        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        return bio.getvalue()

    def test_export_participants(self):
        Participant.objects.create(
            first_name="Export",
            last_name="User",
            name="Export User",
            email="export@example.com",
        )
        request = self.factory.get("/events/api/participants/export", **self._auth_headers())
        response = views.export_participants(request)
        self.assertEqual(response.status_code, 200)
        self.assertIn("application/vnd.openxmlformats", response["Content-Type"])

    def test_import_participants_missing_file(self):
        request = self.factory.post("/events/api/participants/import", **self._auth_headers())
        response = views.import_participants(request)
        self.assertEqual(response.status_code, 400)

    def test_import_participants_invalid_headers(self):
        wb = Workbook()
        ws = wb.active
        ws.append(["BAD", "HEADERS"])
        bio = BytesIO()
        wb.save(bio)
        bio.seek(0)
        upload = SimpleUploadedFile(
            "participants.xlsx",
            bio.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        request = self.factory.post(
            "/events/api/participants/import",
            data={"file": upload},
            **self._auth_headers(),
        )
        response = views.import_participants(request)
        self.assertEqual(response.status_code, 400)

    def test_import_participants_success(self):
        data = self._make_workbook_bytes([[None, "Ana", "Perez", "ana@demo.com"]])
        upload = SimpleUploadedFile(
            "participants.xlsx",
            data,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        request = self.factory.post(
            "/events/api/participants/import",
            data={"file": upload},
            **self._auth_headers(),
        )
        response = views.import_participants(request)
        payload = json.loads(response.content.decode("utf-8"))
        self.assertEqual(response.status_code, 200)
        self.assertTrue(payload["success"])
        self.assertEqual(Participant.objects.count(), 1)
