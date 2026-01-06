import logging

from celery import shared_task

from .s3_service import s3_service

logger = logging.getLogger(__name__)


@shared_task
def delete_event_media_from_s3(event_id, keys):
    if not keys:
        return {"success": True, "deleted": 0, "errors": []}
    if not s3_service.is_configured():
        logger.warning("S3 not configured; skipping cleanup for event %s", event_id)
        return {"success": False, "deleted": 0, "errors": ["S3 not configured"]}

    deleted = 0
    errors = []
    for key in keys:
        result = s3_service.delete_media_fragment(key)
        if result.get("success"):
            deleted += 1
        else:
            errors.append({"key": key, "error": result.get("error")})

    if errors:
        logger.warning(
            "S3 cleanup finished with errors for event %s: %s", event_id, errors
        )
    else:
        logger.info("S3 cleanup finished for event %s (deleted=%s)", event_id, deleted)

    return {"success": not errors, "deleted": deleted, "errors": errors}
