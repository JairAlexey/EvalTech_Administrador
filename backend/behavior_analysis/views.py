import json
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from .tasks import analyze_behavior_task


@csrf_exempt
@require_POST
def trigger_analysis(request):
    try:
        data = json.loads(request.body)
        video_path = data.get("video_path")
        participant_event_id = data.get("participant_event_id")

        if not video_path or not participant_event_id:
            return JsonResponse(
                {"error": "Missing video_path or participant_event_id"}, status=400
            )

        # Trigger the Celery task asynchronously
        task = analyze_behavior_task.delay(video_path, participant_event_id)

        return JsonResponse(
            {"message": "Analysis started", "task_id": task.id}, status=202
        )

    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
