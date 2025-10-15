from django.urls import path
from events import views

urlpatterns = [
    path("logging/http-request", views.log_participant_http_event),
    path("logging/batch-key-presses", views.log_participant_keylogger_event),
    path("logging/screen/capture", views.log_participant_screen_event),
    path("logging/media/capture", views.log_participant_audio_video_event),
    path("verify-event-key", views.verify_event_key),
    # Rutas para la gestión de eventos
    path("api/events", views.event_list_create),
    path("api/events/<int:event_id>", views.event_detail),
    path("api/events/<int:event_id>/emails", views.trigger_emails),
    # Rutas para la gestión de candidatos/participantes
    path("api/candidates", views.participant_list_create),
    path("api/candidates/<int:participant_id>", views.participant_detail),
    path("api/candidates/<int:participant_id>/status", views.participant_status_update),
]
