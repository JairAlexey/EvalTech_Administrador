from django.urls import path
from .views import (
    start_monitoring, 
    stop_monitoring,
    proxy_authenticate_http,
    proxy_validate_url,
    proxy_disconnect_http
)

urlpatterns = [
    # Endpoints de monitoreo
    path("start-monitoring/", start_monitoring, name="start_monitoring"),
    path("stop-monitoring/", stop_monitoring, name="stop_monitoring"),
    
    # Endpoints HTTP para proxy local
    path("auth-http/", proxy_authenticate_http, name="proxy_authenticate_http"),
    path("validate/", proxy_validate_url, name="proxy_validate_url"),
    path("disconnect-http/", proxy_disconnect_http, name="proxy_disconnect_http"),

]