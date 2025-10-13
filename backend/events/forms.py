from events.models import BlockedHost, Event, Participant, ParticipantLog
from django import forms

class ParticipantLogForm(forms.ModelForm):
    class Meta:
        model = ParticipantLog
        fields = "__all__"

class ParticipantForm(forms.ModelForm):
    class Meta:
        model = Participant
        fields = "__all__"

class EventForm(forms.ModelForm):
    class Meta:
        model = Event
        fields = "__all__"