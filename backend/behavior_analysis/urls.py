from django.urls import path
from . import views

urlpatterns = [
    path("analyze/", views.trigger_analysis, name="trigger_analysis"),
]
