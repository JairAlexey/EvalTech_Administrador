from django.contrib import admin
from .forms import AssignedPortForm
from .models import AssignedPort
# Register your models here.

class AssignedPortAdmin(admin.ModelAdmin):
    list_display = ["participant", "port", "last_activity", "session_key", "is_active"]
    search_fields = ["participant"]
    form = AssignedPortForm


admin.site.register(AssignedPort, AssignedPortAdmin)
