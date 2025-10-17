from django.urls import path
from .views import release_port

urlpatterns = [
    path("release-port", release_port),
]