from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
urlpatterns = [
    path("", lambda request: JsonResponse({"status": "ok", "message": "API backend"})),
    path("events/", include("events.urls")),
    path("proxy/", include("proxy.urls")),
    path("auth/", include("authentication.urls")),
    path("analysis/", include("behavior_analysis.urls")),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
