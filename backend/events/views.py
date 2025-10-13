from django.utils import timezone
from datetime import timedelta
from django.http import JsonResponse, HttpRequest
import json
from events.communication import send_bulk_emails
from .models import Participant, ParticipantLog

def check_event_time(event):
    now = timezone.now()
    if event.start_date and event.end_date:
        earliest_join_time = event.start_date - timedelta(minutes=1)
        return earliest_join_time <= now <= event.end_date
    return False

def verify_event_key(request):
    authorization = request.headers.get("Authorization", "")
    
    if not authorization.startswith("Bearer "):
        return JsonResponse({"error": "Invalid format authorization"}, status=401)
    
    event_key = authorization.split(" ")[1]
    try:
        participant = Participant.objects.select_related('event').get(event_key=event_key)
        event = participant.event
        dateIsValid = check_event_time(event)
        return JsonResponse({
            "isValid": True,
            "dateIsValid": dateIsValid,
            "participant": {
                "name": participant.name,
                "email": participant.email
            },
            "event": {
                "name": event.name,
                "id": event.id
            }
        })
    except Participant.DoesNotExist:
        return JsonResponse({"isValid": False}, status=404)

def get_participant(event_key):
    try:
        return Participant.objects.get(event_key=event_key)
    except Participant.DoesNotExist:
        return None

def log_participant_http_event(request: HttpRequest):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        event_key = request.headers.get('Authorization').split()[1]
        participant = get_participant(event_key)
        
        if not participant:
            return JsonResponse({'error': 'Participant not found'}, status=404)
            
        ParticipantLog.objects.create(
            name='http',
            message=data['uri'],
            participant=participant
        )
        return JsonResponse({'status': 'success'})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

def log_participant_keylogger_event(request: HttpRequest):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        data = json.loads(request.body)
        event_key = request.headers.get('Authorization').split()[1]
        participant = get_participant(event_key)
        
        if not participant:
            return JsonResponse({'error': 'Participant not found'}, status=404)
            
        ParticipantLog.objects.create(
            name='keylogger',
            message='\n'.join(data['keys']),
            participant=participant
        )
        return JsonResponse({'status': 'success'})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

def log_participant_screen_event(request: HttpRequest):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        event_key = request.headers.get('Authorization').split()[1]
        participant = get_participant(event_key)
        
        if not participant:
            return JsonResponse({'error': 'Participant not found'}, status=404)
            
        file = request.FILES['screenshot']
        ParticipantLog.objects.create(
            name='screen',
            file=file,
            message='Desktop Screenshot',
            participant=participant
        )
        return JsonResponse({'status': 'success'})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)

def log_participant_audio_video_event(request: HttpRequest):
    if request.method != 'POST':
        return JsonResponse({'error': 'Method not allowed'}, status=405)
    
    try:
        event_key = request.headers.get('Authorization').split()[1]
        participant = get_participant(event_key)
        
        if not participant:
            return JsonResponse({'error': 'Participant not found'}, status=404)
            
        file = request.FILES['media']
        ParticipantLog.objects.create(
            name='audio/video',
            file=file,
            message='Media Capture',
            participant=participant
        )
        return JsonResponse({'status': 'success'})
        
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=400)
    

def trigger_emails(request, event_id):
    try:
        send_bulk_emails(
            event_id=event_id,
            subject="Nuevo comunicado del evento",
            body="<h1>Contenido importante del evento</h1>"
        )
        return JsonResponse({"status": "Correos enviados exitosamente"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)   