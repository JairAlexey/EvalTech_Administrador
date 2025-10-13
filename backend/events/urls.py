from django.urls import path
from events import views

urlpatterns = [
    path("logging/http-request", views.log_participant_http_event),
    path("logging/batch-key-presses", views.log_participant_keylogger_event),
    path("logging/screen/capture", views.log_participant_screen_event),
    path("logging/media/capture", views.log_participant_audio_video_event),
    path("verify-event-key", views.verify_event_key), 

]