import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .models import AnalisisComportamiento
from events.models import ParticipantEvent
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
