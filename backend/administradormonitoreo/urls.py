from django.urls import include, path
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin

urlpatterns = (
    [
        path("api/", include("events.urls")),
        path("api/", include("proxy.urls")),
        path("admin/", admin.site.urls),
    ]
    + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
)
