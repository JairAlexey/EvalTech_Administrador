from celery import shared_task
from .services import procesar_video_completo


@shared_task
def analyze_behavior_task(video_path, participant_event_id):
    """
    Celery task to process the video analysis asynchronously.
    """
    return procesar_video_completo(video_path, participant_event_id)
