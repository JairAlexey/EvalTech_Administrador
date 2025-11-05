from django.urls import path
from .views import release_port, proxy_test

urlpatterns = [
    path("release-port/", release_port, name="release_port"),
    path("test/", proxy_test, name="proxy_test"),
]