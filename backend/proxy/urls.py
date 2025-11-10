from django.urls import path
from .views import release_port, proxy_test, start_monitoring, stop_monitoring

urlpatterns = [
    path("release-port/", release_port, name="release_port"),
    path("test/", proxy_test, name="proxy_test"),
    path("start-monitoring/", start_monitoring, name="start_monitoring"),
    path("stop-monitoring/", stop_monitoring, name="stop_monitoring"),
]