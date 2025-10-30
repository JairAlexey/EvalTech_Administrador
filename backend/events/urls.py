from django.urls import path
from events import views

urlpatterns = [
    path("logging/http-request", views.log_participant_http_event),
    path("logging/batch-key-presses", views.log_participant_keylogger_event),
    path("logging/screen/capture", views.log_participant_screen_event),
    path("logging/media/capture", views.log_participant_audio_video_event),
    path("verify-event-key", views.verify_event_key),
    # Rutas para la gestión de eventos
    path("api/events", views.events),
    path("api/events/<int:event_id>", views.event_detail),
    path("api/events/<int:event_id>/emails", views.send_key_emails),
    # Rutas para la gestión de participantes
    path("api/participants", views.participants),
    path("api/participants/<int:participant_id>", views.participant_detail),
    # Importación masiva de participantes y plantilla
    path("api/participants/import", views.import_participants, name="participants_import"),
    path("api/participants/template", views.participants_template, name="participants_template"),
    # Rutas para paginas
    path("api/websites/", views.websites, name="websites"),
    path("api/websites/<int:website_id>/", views.website_detail, name="website_detail"),
    # Rutas para paginas bloqueadas en eventos
    path(
        "api/<int:event_id>/blocked-hosts/",
        views.event_blocked_hosts,
        name="event_blocked_hosts",
    ),
]
