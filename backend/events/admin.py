from django.contrib import admin
from events.forms import EventForm, ParticipantForm, ParticipantLogForm
from .models import BlockedHost, Event, Participant, ParticipantLog
from .communication import send_emails
# Register your models here.

class BlockedHostAdminInline(admin.TabularInline):
    model = BlockedHost
    extra = 1
    fields = ('hostname',)
    ordering = ('hostname',)

class ParticipantLogAdmin(admin.TabularInline):
    list_display = ["name", "file", "message"]
    search_fields = ["name"]
    list_filter = ["name"]
    form = ParticipantLogForm
    model = ParticipantLog
    extra = 0

class ParticipantAdminInline(admin.TabularInline):
    list_display = ["name", "email", "event"]
    search_fields = ["name", "email"]
    list_filter = ["event"]
    form = ParticipantForm
    model = Participant
    extra = 0
    
class ParticipantAdmin(admin.ModelAdmin):
    list_display = ["name", "email", "event", "is_active"]
    search_fields = ["name", "email"]
    list_filter = ["event"]
    form = ParticipantForm
    inlines = [ParticipantLogAdmin]

class EventAdmin(admin.ModelAdmin):
    list_display = ["name", "start_date", "end_date"]
    search_fields = ["name"]
    list_filter = ["start_date", "end_date"]
    form = EventForm
    inlines = [ParticipantAdminInline, BlockedHostAdminInline] 
    actions = [send_emails]

admin.site.register(Event, EventAdmin)
admin.site.register(Participant, ParticipantAdmin)
