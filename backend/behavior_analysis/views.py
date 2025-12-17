import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import AnalisisComportamiento
from events.models import ParticipantEvent, ParticipantLog
from .tasks import analyze_behavior_task


@csrf_exempt
@require_POST
def register_analysis(request):
    try:
        data = json.loads(request.body)
        video_path = data.get("video_path")
        participant_event_id = data.get("participant_event_id")

        if not video_path or not participant_event_id:
            return JsonResponse(
                {"error": "Missing video_path or participant_event_id"}, status=400
            )

        participant_event = ParticipantEvent.objects.get(id=participant_event_id)

        # Create or update the analysis record
        analisis, created = AnalisisComportamiento.objects.update_or_create(
            participant_event=participant_event,
            defaults={"video_path": video_path, "status": "PENDING"},
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
        task = analyze_behavior_task.delay(analisis.video_path, participant_event_id)

        return JsonResponse(
            {"message": "Analysis started", "task_id": task.id}, status=202
        )

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_POST
def report_tampering(request):
    """
    Endpoint para reportar manipulación del proxy por parte del usuario
    Guarda el incidente en los logs del participante
    """
    try:
        # Obtener token de autorización
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({"error": "Authorization required"}, status=401)
        
        event_key = auth_header.replace('Bearer ', '')
        
        # Verificar que existe el participante
        try:
            participant_event = ParticipantEvent.objects.get(event_key=event_key)
        except ParticipantEvent.DoesNotExist:
            return JsonResponse({"error": "Invalid event key"}, status=404)
        
        # Parsear datos del reporte
        data = json.loads(request.body)
        reason = data.get('reason', 'Unknown')
        tampering_type = data.get('type', 'proxy_manipulation')
        timestamp = data.get('timestamp', '')
        
        # Crear mensaje descriptivo para el log
        message = f"⚠️ ALERTA DE SEGURIDAD: {tampering_type} - {reason}"
        if timestamp:
            message += f" (Timestamp: {timestamp})"
        
        # Guardar en logs de participante
        ParticipantLog.objects.create(
            name="tampering_alert",
            message=message,
            participant_event=participant_event
        )
        
        print(f"⚠️ TAMPERING REPORTADO - Usuario: {participant_event.participant.name}, Razón: {reason}")
        
        return JsonResponse({
            "message": "Tampering reported successfully",
            "logged_as": "tampering_alert"
        }, status=200)
        
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        print(f"Error en report_tampering: {e}")
        return JsonResponse({"error": str(e)}, status=500)
