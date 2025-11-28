from django.urls import path
from . import views

urlpatterns = [
    path("register/", views.register_analysis, name="register_video"),
    path("analyze/", views.trigger_analysis, name="trigger_analysis"),
]
