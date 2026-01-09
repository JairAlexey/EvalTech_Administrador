from datetime import datetime, timedelta
from io import BytesIO
from unittest import mock

from botocore.exceptions import ClientError, NoCredentialsError
from django.test import TestCase

from events.s3_service import S3Service, s3_service


class S3ServiceTests(TestCase):
    def setUp(self):
        s3_service.bucket_name = "bucket"
        s3_service._is_configured = True

    def test_generate_media_key_extension(self):
        key = s3_service.generate_media_key(1, media_type="screen")
        self.assertIn(".jpg", key)

    def test_upload_media_fragment_success(self):
        data = BytesIO(b"data")

        with mock.patch.object(
            s3_service, "is_configured", return_value=True
        ), mock.patch.object(
            s3_service, "generate_presigned_url", return_value="http://signed"
        ), mock.patch.object(
            s3_service, "s3_client"
        ) as s3_client:
            s3_client.upload_fileobj.return_value = None
            result = s3_service.upload_media_fragment(data, 1, media_type="video")

        self.assertTrue(result["success"])
        self.assertIn("key", result)

    def test_create_bucket_if_exists(self):
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.head_bucket.return_value = None
            result = s3_service.create_bucket_if_not_exists()

        self.assertTrue(result)

    def test_create_bucket_if_missing(self):
        error = ClientError({"Error": {"Code": "404"}}, "HeadBucket")
        with mock.patch.object(s3_service, "s3_client") as s3_client, mock.patch.object(
            s3_service, "_configure_bucket_policies"
        ) as configure_mock:
            s3_client.head_bucket.side_effect = error
            s3_client.create_bucket.return_value = None
            result = s3_service.create_bucket_if_not_exists()

        self.assertTrue(result)
        configure_mock.assert_called_once()

    def test_create_bucket_if_missing_non_us_region(self):
        original_region = s3_service.region
        s3_service.region = "eu-west-1"
        error = ClientError({"Error": {"Code": "404"}}, "HeadBucket")
        with mock.patch.object(s3_service, "s3_client") as s3_client, mock.patch.object(
            s3_service, "_configure_bucket_policies"
        ) as configure_mock:
            s3_client.head_bucket.side_effect = error
            s3_client.create_bucket.return_value = None
            result = s3_service.create_bucket_if_not_exists()

        s3_service.region = original_region
        self.assertTrue(result)
        configure_mock.assert_called_once()

    def test_generate_presigned_url_not_configured(self):
        s3_service._is_configured = False
        result = s3_service.generate_presigned_url("key")
        self.assertIsNone(result)

    def test_list_participant_media(self):
        with mock.patch.object(s3_service, "s3_client") as s3_client, mock.patch.object(
            s3_service, "generate_presigned_url", return_value="signed"
        ):
            s3_client.list_objects_v2.return_value = {
                "Contents": [
                    {
                        "Key": "media/participant_events/1/video_1.webm",
                        "Size": 100,
                        "LastModified": "now",
                    },
                    {
                        "Key": "media/participant_events/1/screen_1.jpg",
                        "Size": 50,
                        "LastModified": "now",
                    },
                ]
            }
            s3_client.head_object.return_value = {"Metadata": {"media_type": "video"}}

            files = s3_service.list_participant_media(1)

        self.assertEqual(len(files), 2)

    def test_get_media_fragment_info_not_found(self):
        error = ClientError({"Error": {"Code": "NoSuchKey"}}, "HeadObject")
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.head_object.side_effect = error
            result = s3_service.get_media_fragment_info("missing")

        self.assertIsNone(result)

    def test_delete_media_fragment_not_configured(self):
        s3_service._is_configured = False
        result = s3_service.delete_media_fragment("key")
        self.assertFalse(result["success"])

    def test_generate_presigned_url_success(self):
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.generate_presigned_url.return_value = "signed"
            url = s3_service.generate_presigned_url("key")

        self.assertEqual(url, "signed")

    def test_upload_media_fragment_not_configured(self):
        s3_service._is_configured = False
        result = s3_service.upload_media_fragment(BytesIO(b"data"), 1)
        self.assertFalse(result["success"])

    def test_configure_bucket_policies_success(self):
        with mock.patch(
            "events.s3_service.boto3.client", return_value=mock.Mock()
        ):
            service = S3Service()
            service.bucket_name = "bucket"
            service._is_configured = True
            service.s3_client = mock.Mock()

            service._configure_bucket_policies()

            service.s3_client.put_public_access_block.assert_called_once()
            service.s3_client.put_bucket_versioning.assert_called_once()
            service.s3_client.put_bucket_lifecycle_configuration.assert_called_once()

    def test_upload_media_fragment_client_error(self):
        data = BytesIO(b"data")
        error = ClientError({"Error": {"Code": "500"}}, "UploadFileobj")
        with mock.patch.object(
            s3_service, "is_configured", return_value=True
        ), mock.patch.object(
            s3_service, "generate_presigned_url", return_value="http://signed"
        ), mock.patch.object(
            s3_service, "s3_client"
        ) as s3_client:
            s3_client.upload_fileobj.side_effect = error
            result = s3_service.upload_media_fragment(data, 1, media_type="video")

        self.assertFalse(result["success"])

    def test_delete_media_fragment_success_and_error(self):
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.delete_object.return_value = None
            result = s3_service.delete_media_fragment("key")
        self.assertTrue(result["success"])

        error = ClientError({"Error": {"Code": "500"}}, "DeleteObject")
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.delete_object.side_effect = error
            result = s3_service.delete_media_fragment("key")
        self.assertFalse(result["success"])

    def test_get_media_fragment_info_success(self):
        response = {
            "ContentLength": 10,
            "LastModified": "now",
            "ContentType": "video/webm",
            "Metadata": {"media_type": "video"},
        }
        with mock.patch.object(s3_service, "s3_client") as s3_client, mock.patch.object(
            s3_service, "generate_presigned_url", return_value="signed"
        ):
            s3_client.head_object.return_value = response
            info = s3_service.get_media_fragment_info("media/key")

        self.assertEqual(info["key"], "media/key")

    def test_cleanup_old_fragments(self):
        old = datetime.now() - timedelta(days=40)
        recent = datetime.now()
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.list_objects_v2.return_value = {
                "Contents": [
                    {"Key": "media/old", "LastModified": old},
                    {"Key": "media/recent", "LastModified": recent},
                ]
            }
            s3_client.delete_object.return_value = None
            result = s3_service.cleanup_old_fragments(days_old=30)

        self.assertEqual(result["deleted_count"], 1)

    def test_download_file_success_and_error(self):
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.download_file.return_value = None
            result = s3_service.download_file("media/key", "local.file")

        self.assertTrue(result["success"])

        error = ClientError({"Error": {"Code": "500"}}, "DownloadFile")
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.download_file.side_effect = error
            result = s3_service.download_file("media/key", "local.file")

        self.assertFalse(result["success"])

    def test_service_init_no_credentials(self):
        with mock.patch(
            "events.s3_service.boto3.client", side_effect=NoCredentialsError()
        ):
            service = S3Service()

        self.assertFalse(service.is_configured())

    def test_generate_presigned_url_error(self):
        error = ClientError({"Error": {"Code": "500"}}, "Presign")
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.generate_presigned_url.side_effect = error
            url = s3_service.generate_presigned_url("key")

        self.assertIsNone(url)

    def test_list_participant_media_metadata_error(self):
        error = ClientError({"Error": {"Code": "500"}}, "HeadObject")
        with mock.patch.object(s3_service, "s3_client") as s3_client, mock.patch.object(
            s3_service, "generate_presigned_url", return_value="signed"
        ):
            s3_client.list_objects_v2.return_value = {
                "Contents": [
                    {
                        "Key": "media/participant_events/1/video_1.webm",
                        "Size": 100,
                        "LastModified": "now",
                    }
                ]
            }
            s3_client.head_object.side_effect = error
            files = s3_service.list_participant_media(1)

        self.assertEqual(files[0]["media_type"], "unknown")

    def test_cleanup_old_fragments_error(self):
        error = ClientError({"Error": {"Code": "500"}}, "ListObjects")
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.list_objects_v2.side_effect = error
            result = s3_service.cleanup_old_fragments()

        self.assertFalse(result["deleted_count"])
        self.assertTrue(result["errors"])

    def test_download_file_unexpected_error(self):
        with mock.patch.object(s3_service, "s3_client") as s3_client:
            s3_client.download_file.side_effect = RuntimeError("boom")
            result = s3_service.download_file("media/key", "local.file")

        self.assertFalse(result["success"])
