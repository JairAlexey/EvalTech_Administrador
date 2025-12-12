import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import AnalisisComportamiento
from events.models import ParticipantEvent, Event
from .tasks import analyze_behavior_task
from .video_merger import video_merger_service

logger = logging.getLogger(__name__)


@csrf_exempt
@require_POST
def register_analysis(request):
    try:
        data = json.loads(request.body)
        video_link = data.get("video_link") or data.get(
            "video_path"
        )  # Mantener compatibilidad
        participant_event_id = data.get("participant_event_id")

        if not video_link or not participant_event_id:
            return JsonResponse(
                {"error": "Missing video_link or participant_event_id"}, status=400
            )

        participant_event = ParticipantEvent.objects.get(id=participant_event_id)

        # Create or update the analysis record
        analisis, created = AnalisisComportamiento.objects.update_or_create(
            participant_event=participant_event,
            defaults={"video_link": video_link, "status": "PENDING"},
        )

        return JsonResponse(
            {"message": "Video registered successfully", "id": analisis.id}, status=201
        )

    except ParticipantEvent.DoesNotExist:
        return JsonResponse({"error": "ParticipantEvent not found"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_POST
def trigger_analysis(request):
    try:
        data = json.loads(request.body)
        participant_event_id = data.get("participant_event_id")

        if not participant_event_id:
            return JsonResponse({"error": "Missing participant_event_id"}, status=400)

        # Retrieve the registered analysis to get the video path
        try:
            analisis = AnalisisComportamiento.objects.get(
                participant_event_id=participant_event_id
            )
        except AnalisisComportamiento.DoesNotExist:
            return JsonResponse(
                {
                    "error": "Analysis request not found for this event. Register video first."
                },
                status=404,
            )

        # Trigger the Celery task asynchronously
        task = analyze_behavior_task.delay(analisis.video_link, participant_event_id)

        return JsonResponse(
            {"message": "Analysis started", "task_id": task.id}, status=202
        )

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_POST
def merge_participant_video(request):
    """
    Endpoint para unir todos los videos de un participante en orden cronológico
    y subir el resultado a S3.
    """
    try:
        data = json.loads(request.body)
        participant_event_id = data.get("participant_event_id")

        if not participant_event_id:
            return JsonResponse({"error": "Missing participant_event_id"}, status=400)

        # Verificar que el ParticipantEvent existe
        try:
            participant_event = ParticipantEvent.objects.get(id=participant_event_id)
        except ParticipantEvent.DoesNotExist:
            return JsonResponse({"error": "ParticipantEvent not found"}, status=404)

        logger.info(
            f"Starting video merge for participant_event {participant_event_id}"
        )

        # Usar el servicio de merger para unir videos
        result = video_merger_service.merge_participant_videos(participant_event_id)

        if result["success"]:
            return JsonResponse(
                {
                    "message": "Videos merged successfully",
                    "video_url": result["video_url"],
                    "merged_count": result["merged_count"],
                },
                status=200,
            )
        else:
            return JsonResponse(
                {"error": f"Failed to merge videos: {result['error']}"}, status=500
            )

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Unexpected error in merge_participant_video: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_POST
def process_event_completion(request):
    """
    Endpoint principal que se llama cuando un evento termina.
    Inicia tareas asíncronas para procesar cada participante en paralelo.
    """
    try:
        data = json.loads(request.body)
        event_id = data.get("event_id")

        if not event_id:
            return JsonResponse({"error": "Missing event_id"}, status=400)

        # Verificar que el evento existe
        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            return JsonResponse({"error": "Event not found"}, status=404)

        logger.info(f"Processing completion for event {event_id}: {event.name}")

        # Obtener todos los ParticipantEvents del evento
        participant_events = ParticipantEvent.objects.filter(event=event)

        if not participant_events.exists():
            return JsonResponse(
                {"error": "No participants found for this event"}, status=404
            )

        # Iniciar tareas asíncronas para cada participante
        task_ids = []
        participant_data = []

        for participant_event in participant_events:
            # Importar la tarea aquí para evitar circular imports
            from .tasks import process_participant_completion_task

            # Iniciar tarea asíncrona para este participante
            task = process_participant_completion_task.delay(
                participant_event.id, event_id, event.name
            )

            task_ids.append(task.id)
            participant_data.append(
                {
                    "participant_event_id": participant_event.id,
                    "participant_name": participant_event.participant.name,
                    "task_id": task.id,
                }
            )

            logger.info(
                f"Started async processing for participant {participant_event.participant.name} (ID: {participant_event.id}) - Task: {task.id}"
            )

        return JsonResponse(
            {
                "message": f"Event completion processing started asynchronously",
                "event_id": event_id,
                "event_name": event.name,
                "total_participants": len(participant_data),
                "processing_mode": "async",
                "task_ids": task_ids,
                "participants": participant_data,
                "note": "Processing will continue in background. Check Celery logs for progress.",
            },
            status=202,
        )  # 202 = Accepted (processing started)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        logger.error(f"Unexpected error in process_event_completion: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
