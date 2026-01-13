from django.urls import path
from events import views

urlpatterns = [
    # Rutas para el registro de eventos de los participantes
    path("api/logging/http-request", views.log_participant_http_event),
    path("api/logging/screen/presign", views.presign_participant_screen_upload),
    path("api/logging/media/presign", views.presign_participant_media_upload),
    path("api/logging/screen/capture", views.log_participant_screen_event),
    path("api/logging/media/capture", views.log_participant_audio_video_event),
    path("api/verify-event-key", views.verify_event_key),
    # Rutas para consentimiento informado
    path("api/consent/register", views.register_event_consent, name="register_consent"),
    path("api/consent/check", views.check_event_consent, name="check_consent"),
    # Rutas para consultar logs de participantes
    path(
        "api/events/<int:event_id>/participants/<int:participant_id>/connection-stats/",
        views.participant_connection_stats,
    ),
    path(
        "api/events/<int:event_id>/participants/<int:participant_id>/logs/",
        views.event_participant_logs,
    ),
    # Rutas para gestión de archivos multimedia en S3
    path(
        "api/events/<int:event_id>/participants/<int:participant_id>/media/",
        views.participant_media_files,
        name="participant-media-files",
    ),
    path(
        "api/s3/bucket/create/",
        views.create_s3_bucket,
        name="create-s3-bucket",
    ),
    # Rutas para la gestión de eventos
    path("api/events", views.events),
    path("api/events/<int:event_id>", views.event_detail),
    path("api/events/<int:event_id>/emails", views.send_key_emails),
    # Rutas para la gestión de participantes
    path("api/participants", views.participants),
    path("api/participants/<int:participant_id>", views.participant_detail),
    # Bloquear/desbloquear participantes de un evento
    path("api/events/<int:event_id>/participants/block", views.block_participants),
    path("api/events/<int:event_id>/participants/unblock", views.unblock_participants),
    # Importación masiva de participantes y plantilla
    path(
        "api/participants/import", views.import_participants, name="participants_import"
    ),
    path(
        "api/participants/export",
        views.export_participants,
        name="participants_export",
    ),
    # Rutas para paginas
    path("api/websites/", views.websites, name="websites"),
    path("api/websites/<int:website_id>/", views.website_detail, name="website_detail"),
    # Rutas para paginas bloqueadas en eventos
    path(
        "api/<int:event_id>/blocked-hosts/",
        views.event_blocked_hosts,
        name="event_blocked_hosts",
    ),
    path(
        "api/<int:event_id>/notify-proxy-update/",
        views.notify_proxy_blocked_hosts_update,
        name="notify_proxy_blocked_hosts_update",
    ),
    # Rutas para evaluaciones
    path("api/evaluations", views.evaluaciones, name="evaluaciones"),
    path(
        "api/evaluations/<int:evaluation_id>",
        views.evaluation_detail,
        name="evaluation_detail",
    ),
    # Rutas para estados de eventos
    path(
        "api/events-status/<int:event_id>/start/",
        views.start_event,
        name="event-start",
    ),
    path(
        "api/events-status/<int:event_id>/finish/",
        views.finish_event,
        name="event-finish",
    ),
    path(
        "api/events-status/pending-start/",
        views.pending_start_events,
        name="events-pending-start",
    ),
    path(
        "api/events-status/pending-finish/",
        views.pending_finish_events,
        name="events-pending-finish",
    ),
]
