from unittest import mock

from django.test import TestCase

from events.tasks import delete_event_media_from_s3


class EventsTasksTests(TestCase):
    def test_delete_event_media_from_s3_no_keys(self):
        result = delete_event_media_from_s3(1, [])

        self.assertTrue(result["success"])
        self.assertEqual(result["deleted"], 0)
        self.assertEqual(result["errors"], [])

    def test_delete_event_media_from_s3_not_configured(self):
        with mock.patch("events.tasks.s3_service.is_configured", return_value=False):
            result = delete_event_media_from_s3(2, ["media/key"])

        self.assertFalse(result["success"])
        self.assertEqual(result["deleted"], 0)
        self.assertIn("S3 not configured", result["errors"][0])

    def test_delete_event_media_from_s3_success(self):
        with mock.patch(
            "events.tasks.s3_service.is_configured", return_value=True
        ), mock.patch(
            "events.tasks.s3_service.delete_media_fragment",
            return_value={"success": True},
        ) as delete_mock:
            result = delete_event_media_from_s3(3, ["media/k1", "media/k2"])

        self.assertTrue(result["success"])
        self.assertEqual(result["deleted"], 2)
        self.assertEqual(result["errors"], [])
        self.assertEqual(delete_mock.call_count, 2)

    def test_delete_event_media_from_s3_partial_failure(self):
        with mock.patch(
            "events.tasks.s3_service.is_configured", return_value=True
        ), mock.patch(
            "events.tasks.s3_service.delete_media_fragment",
            side_effect=[{"success": True}, {"success": False, "error": "boom"}],
        ):
            result = delete_event_media_from_s3(4, ["media/ok", "media/fail"])

        self.assertFalse(result["success"])
        self.assertEqual(result["deleted"], 1)
        self.assertEqual(len(result["errors"]), 1)
