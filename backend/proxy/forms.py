from proxy.models import AssignedPort
from django import forms

class AssignedPortForm(forms.ModelForm):
    class Meta:
        model = AssignedPort
        fields = "__all__"

