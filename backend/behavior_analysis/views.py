import json
import logging
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.core.serializers.json import DjangoJSONEncoder
from .models import AnalisisComportamiento
from events.models import ParticipantEvent, Event, ParticipantLog
from .tasks import analyze_behavior_task
from .video_merger import video_merger_service
from events.s3_service import s3_service
from authentication.utils import jwt_required

logger = logging.getLogger(__name__)


def _extract_s3_key(video_reference):
    """Normaliza una referencia de video retornando la key de S3 si viene como URL."""
    if not video_reference:
        return None
    if "amazonaws.com" in video_reference:
        return video_reference.split(".amazonaws.com/")[-1].split("?")[0]
    return video_reference


def _get_presigned_url(key):
    if not key or not s3_service.is_configured():
        return None
    try:
        return s3_service.generate_presigned_url(key)
    except Exception:
        return None


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

        video_key = _extract_s3_key(video_link)
        if not video_key:
            return JsonResponse({"error": "Invalid video reference"}, status=400)

        participant_event = ParticipantEvent.objects.get(id=participant_event_id)

        # Create or update the analysis record
        analisis, created = AnalisisComportamiento.objects.update_or_create(
            participant_event=participant_event,
            defaults={"video_link": video_key, "status": "pendiente"},
        )

        return JsonResponse(
            {
                "message": "Video registered successfully",
                "id": analisis.id,
                "video_key": video_key,
                "video_url": _get_presigned_url(video_key),
            },
            status=201,
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
    Endpoint para unir todos los videos de un participante en orden cronologico
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
            video_key = (
                result.get("s3_key") or result.get("video_key") or result.get("key")
            )
            if not video_key:
                return JsonResponse(
                    {"error": "Merged video key not available"}, status=500
                )
            presigned_url = result.get("video_url") or _get_presigned_url(video_key)
            return JsonResponse(
                {
                    "message": "Videos merged successfully",
                    "video_url": presigned_url,
                    "video_key": video_key,
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
@jwt_required()
@require_GET
def analysis_status(request, event_id, participant_id):
    try:
        participant_event = ParticipantEvent.objects.select_related(
            "participant", "event"
        ).get(event_id=event_id, participant_id=participant_id)
    except ParticipantEvent.DoesNotExist:
        return JsonResponse({"error": "ParticipantEvent not found"}, status=404)

    analysis = getattr(participant_event, "analisis_comportamiento", None)
    video_key = getattr(analysis, "video_link", None) if analysis else None
    video_url = _get_presigned_url(video_key) or video_key

    data = {
        "event": {
            "id": participant_event.event.id,
            "name": participant_event.event.name,
        },
        "participant": {
            "id": participant_event.participant.id,
            "name": participant_event.participant.name,
            "email": participant_event.participant.email,
        },
        "analysis": {
            "id": getattr(analysis, "id", None),
            "status": getattr(analysis, "status", "no_solicitado"),
            "video_link": video_url,
            "video_key": video_key,
            "fecha_procesamiento": getattr(analysis, "fecha_procesamiento", None),
        },
    }

    return JsonResponse(data, status=200, encoder=DjangoJSONEncoder)


@csrf_exempt
@jwt_required()
@require_GET
def analysis_report(request, event_id, participant_id):
    """Endpoint completo para obtener el reporte de analisis con todos los registros"""
    try:
        participant_event = ParticipantEvent.objects.select_related(
            "participant", "event"
        ).get(event_id=event_id, participant_id=participant_id)
    except ParticipantEvent.DoesNotExist:
        return JsonResponse({"error": "ParticipantEvent not found"}, status=404)

    analysis = getattr(participant_event, "analisis_comportamiento", None)

    if not analysis:
        return JsonResponse(
            {
                "error": "No analysis found for this participant",
                "status": "no_solicitado",
            },
            status=404,
        )

    video_key = analysis.video_link
    video_url = _get_presigned_url(video_key) or video_key

    # Recopilar todos los registros relacionados
    registros_rostros = list(
        analysis.registros_rostros.values(
            "id", "persona_id", "tiempo_inicio", "tiempo_fin"
        ).order_by("tiempo_inicio")
    )

    registros_gestos = list(
        analysis.registros_gestos.values(
            "id", "tipo_gesto", "tiempo_inicio", "tiempo_fin", "duracion"
        ).order_by("tiempo_inicio")
    )

    registros_iluminacion = list(
        analysis.registros_iluminacion.values("id", "tiempo_inicio", "tiempo_fin").order_by("tiempo_inicio")
    )

    registros_voz = list(
        analysis.registros_voz.values(
            "id", "tipo_log", "etiqueta_hablante", "tiempo_inicio", "tiempo_fin"
        ).order_by("tiempo_inicio")
    )

    anomalias_lipsync = list(
        analysis.anomalias_lipsync.values(
            "id", "tipo_anomalia", "tiempo_inicio", "tiempo_fin"
        ).order_by("tiempo_inicio")
    )

    registros_ausencia = list(
        analysis.registros_ausencia.values(
            "id", "tiempo_inicio", "tiempo_fin", "duracion"
        ).order_by("tiempo_inicio")
    )
    # Obtener logs de actividad del participante (excluyendo keylogger)
    screenshots_queryset = (
        ParticipantLog.objects.filter(
            participant_event=participant_event, name="screen"
        )
        .values("id", "timestamp", "url", "message")
        .order_by("timestamp")
    )

    screenshots_logs = []
    for log in screenshots_queryset:
        screenshot_data = {
            "id": log["id"],
            "timestamp": log["timestamp"],
            "url": _get_presigned_url(log["url"]) if log["url"] else None,
            "message": log["message"],
        }
        screenshots_logs.append(screenshot_data)

    # Contar videos
    total_videos = ParticipantLog.objects.filter(
        participant_event=participant_event, name="audio/video"
    ).count()

    # Contar desconexiones del proxy
    total_proxy_disconnections = ParticipantLog.objects.filter(
        participant_event=participant_event, name="proxy"
    ).count()

    # Solo peticiones bloqueadas (las unicas que se guardan en logs HTTP)
    blocked_requests = list(
        ParticipantLog.objects.filter(participant_event=participant_event, name="http")
        .values("id", "message", "timestamp", "url")
        .order_by("-timestamp")
    )

    # Informacion de monitoreo
    monitoring_info = {
        "total_duration_seconds": participant_event.monitoring_total_duration or 0,
        "sessions_count": participant_event.monitoring_sessions_count or 0,
        "last_change": participant_event.monitoring_last_change,
    }

    # Calcular estadisticas
    total_rostros_detectados = len(set(r["persona_id"] for r in registros_rostros))
    total_gestos = len(registros_gestos)
    total_anomalias_iluminacion = len(registros_iluminacion)
    total_anomalias_voz = len([v for v in registros_voz if v["tipo_log"] == "susurro"])
    total_hablantes = len([v for v in registros_voz if v["tipo_log"] == "hablante"])
    total_anomalias_lipsync = len(anomalias_lipsync)
    total_ausencias = len(registros_ausencia)
    tiempo_total_ausencia = sum(r["duracion"] for r in registros_ausencia)

    data = {
        "event": {
            "id": participant_event.event.id,
            "name": participant_event.event.name,
            "duration": participant_event.event.duration,
        },
        "participant": {
            "id": participant_event.participant.id,
            "name": participant_event.participant.name,
            "email": participant_event.participant.email,
        },
        "analysis": {
            "id": analysis.id,
            "status": analysis.status,
            "video_link": video_url,
            "video_key": video_key,
            "fecha_procesamiento": analysis.fecha_procesamiento,
        },
        "statistics": {
            "total_rostros_detectados": total_rostros_detectados,
            "total_gestos": total_gestos,
            "total_anomalias_iluminacion": total_anomalias_iluminacion,
            "total_anomalias_voz": total_anomalias_voz,
            "total_hablantes": total_hablantes,
            "total_anomalias_lipsync": total_anomalias_lipsync,
            "total_ausencias": total_ausencias,
            "tiempo_total_ausencia_segundos": round(tiempo_total_ausencia, 2),
            "total_screenshots": len(screenshots_logs),
            "total_videos": total_videos,
            "total_blocked_requests": len(blocked_requests),
            "total_proxy_disconnections": total_proxy_disconnections,
        },
        "registros": {
            "rostros": registros_rostros,
            "gestos": registros_gestos,
            "iluminacion": registros_iluminacion,
            "voz": registros_voz,
            "lipsync": anomalias_lipsync,
            "ausencias": registros_ausencia,
        },
        "activity_logs": {
            "screenshots": screenshots_logs,
            "blocked_requests": blocked_requests[:100],  # Limitar a ultimas 100
        },
        "monitoring": monitoring_info,
    }

    return JsonResponse(data, status=200, encoder=DjangoJSONEncoder)


@csrf_exempt
@require_POST
def process_event_completion(request):
    """
    Endpoint principal que se llama cuando un evento termina.
    Inicia tareas asincronas para procesar cada participante en paralelo.
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

        # Iniciar tareas asincronas para cada participante
        task_ids = []
        participant_data = []
        skipped_participants = []

        for participant_event in participant_events:
            # Importar la tarea aqui para evitar circular imports
            from .tasks import process_participant_completion_task

            # Si el participante nunca envio video/audio no lo encolamos
            has_video_logs = ParticipantLog.objects.filter(
                participant_event=participant_event,
                name="audio/video",
                url__isnull=False,
            ).exists()
            if not has_video_logs:
                skipped_participants.append(
                    {
                        "participant_event_id": participant_event.id,
                        "participant_name": participant_event.participant.name,
                        "reason": "sin_videos",
                    }
                )
                logger.info(
                    f"Skipping participant {participant_event.participant.name} (ID: {participant_event.id}) - no video logs"
                )
                continue

            # Iniciar tarea asincrona para este participante
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
                "skipped_participants": skipped_participants,
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
