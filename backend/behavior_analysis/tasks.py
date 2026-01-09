import logging
from celery import shared_task
from .services import procesar_video_completo
from .models import AnalisisComportamiento
from events.models import ParticipantEvent
from .video_merger import video_merger_service

logger = logging.getLogger(__name__)


@shared_task
def analyze_behavior_task(video_path, participant_event_id):
    """
    Celery task to process the video analysis asynchronously.
    """
    return procesar_video_completo(video_path, participant_event_id)


@shared_task(bind=True)
def process_participant_completion_task(self, participant_event_id, event_id, event_name):
    """
    Tarea asíncrona para procesar la finalización de un participante específico.
    Esta tarea se ejecuta en paralelo para cada participante.
    
    Args:
        participant_event_id: ID del ParticipantEvent
        event_id: ID del evento (para logging)
        event_name: Nombre del evento (para logging)
    """
    try:
        # Verificar que el ParticipantEvent existe
        try:
            participant_event = ParticipantEvent.objects.get(id=participant_event_id)
        except ParticipantEvent.DoesNotExist:
            error_msg = f"ParticipantEvent {participant_event_id} not found"
            logger.error(error_msg)
            return {'success': False, 'error': error_msg}

        participant_name = participant_event.participant.name
        logger.info(f"[Task {self.request.id}] Processing participant {participant_name} (ID: {participant_event_id}) for event {event_name}")

        # Paso 1: Unir videos del participante
        logger.info(f"[Task {self.request.id}] Step 1/3: Merging videos for participant {participant_name}")
        merge_result = video_merger_service.merge_participant_videos(participant_event_id)

        # Si no hay videos, marcamos como omitido y no avanzamos
        if merge_result.get('skipped'):
            msg = f"No video logs for participant_event {participant_event_id}, skipping analysis"
            logger.info(f"[Task {self.request.id}] {msg}")
            return {
                'success': False,
                'skipped': True,
                'error': merge_result.get('error') or msg,
                'participant_event_id': participant_event_id,
                'participant_name': participant_name
            }

        if not merge_result['success']:
            error_msg = f"Video merge failed: {merge_result['error']}"
            logger.error(f"[Task {self.request.id}] {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'participant_event_id': participant_event_id,
                'participant_name': participant_name
            }
        
        video_key = merge_result.get('s3_key') or merge_result.get('video_key') or merge_result.get('key')
        video_url = merge_result.get('video_url')
        if not video_key:
            error_msg = "Video merge did not return an S3 key"
            logger.error(f"[Task {self.request.id}] {error_msg}")
            return {
                'success': False,
                'error': error_msg,
                'participant_event_id': participant_event_id,
                'participant_name': participant_name
            }

        merged_count = merge_result['merged_count']
        logger.info(f"[Task {self.request.id}] Videos merged successfully: key={video_key}, url={video_url} ({merged_count} fragments)")
        
        # Paso 2: Registrar análisis con el video unido
        logger.info(f"[Task {self.request.id}] Step 2/3: Registering analysis for participant {participant_name}")
        analisis, created = AnalisisComportamiento.objects.update_or_create(
            participant_event=participant_event,
            defaults={"video_link": video_key, "status": "pendiente"},
        )
        logger.info(f"[Task {self.request.id}] Analysis registered (created: {created})")
        
        # Paso 3: Iniciar análisis de comportamiento
        logger.info(f"[Task {self.request.id}] Step 3/3: Starting behavior analysis for participant {participant_name}")
        analysis_task = analyze_behavior_task.delay(video_key, participant_event_id)
        logger.info(f"[Task {self.request.id}] Behavior analysis task started: {analysis_task.id}")
        
        result = {
            'success': True,
            'participant_event_id': participant_event_id,
            'participant_name': participant_name,
            'video_url': video_url,
            'video_key': video_key,
            'merged_count': merged_count,
            'analysis_task_id': analysis_task.id,
            'processing_task_id': self.request.id
        }
        
        logger.info(f"[Task {self.request.id}] ✓ Participant {participant_name} processing completed successfully")
        return result
        
    except Exception as e:
        error_msg = f"Unexpected error processing participant {participant_event_id}: {str(e)}"
        logger.error(f"[Task {self.request.id}] {error_msg}", exc_info=True)
        return {
            'success': False,
            'error': error_msg,
            'participant_event_id': participant_event_id,
            'processing_task_id': self.request.id
        }
