from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.register_analysis, name="register_video"),
    path("analyze/", views.trigger_analysis, name="trigger_analysis"),
    path("merge-video/", views.merge_participant_video, name="merge_participant_video"),
    path("process-event-completion/", views.process_event_completion, name="process_event_completion"),
    path(
        "status/<int:event_id>/participants/<int:participant_id>/",
        views.analysis_status,
        name="analysis_status",
    ),
    path(
        "report/<int:event_id>/participants/<int:participant_id>/",
        views.analysis_report,
        name="analysis_report",
    ),
]
