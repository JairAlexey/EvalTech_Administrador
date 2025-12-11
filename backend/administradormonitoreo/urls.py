from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from events.media_views import (
    serve_media_file,
    serve_s3_media_file,
    get_s3_presigned_url,
)

urlpatterns = [
    path("", lambda request: JsonResponse({"status": "ok", "message": "API backend"})),
    path("events/", include("events.urls")),
    path("proxy/", include("proxy.urls")),
    path("auth/", include("authentication.urls")),
    path("analysis/", include("behavior_analysis.urls")),
    # Vista personalizada para archivos multimedia con mejor streaming
    path("media/<path:file_path>", serve_media_file, name="serve_media"),
    # Rutas para archivos en S3
    path("s3-media/<path:s3_key>", serve_s3_media_file, name="serve_s3_media"),
    path("api/s3-url/<path:s3_key>", get_s3_presigned_url, name="get_s3_presigned_url"),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
