from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from events.media_views import serve_media_file

urlpatterns = [
    path(
        "", lambda request: JsonResponse({"status": "ok", "message": "API backend"})
    ),
    path("events/", include("events.urls")),
    path("proxy/", include("proxy.urls")),
    path("auth/", include("authentication.urls")),
    # Vista personalizada para archivos multimedia con mejor streaming
    path("media/<path:file_path>", serve_media_file, name="serve_media"),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

