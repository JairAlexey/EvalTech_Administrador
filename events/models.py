from django.db import models
import hashlib

# Create your models here.
class Event(models.Model):
    name = models.CharField(max_length=200)
    start_date = models.DateTimeField(null=True)
    end_date = models.DateTimeField(null=True)
    
    def __str__(self):
        return self.name

class Participant(models.Model):
    name = models.CharField(max_length=200)
    email = models.EmailField()
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    event_key = models.CharField(max_length=128, blank=True, null=True, unique=True)
    is_active = models.BooleanField(default=False)
    
    def __str__(self):
        return self.name
    
    def generate_event_key(self):
        self.event_key = hashlib.blake2b((str(self.event.id) + self.email).encode(), digest_size=8).hexdigest()
        
    class Meta:
        unique_together = [("event", "email")] 
    
    def save(self, *args, **kwargs):
        self.generate_event_key()
        return super().save(*args, **kwargs)

class ParticipantLog(models.Model):
    name = models.CharField(max_length=200)
    file = models.FileField(upload_to="logs", null=True, blank=True)  
    message = models.TextField()
    participant = models.ForeignKey(Participant, on_delete=models.CASCADE, null=True)

    def __str__(self):
        return self.name
    

class BlockedHost(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name='blocked_hosts')
    hostname = models.CharField(max_length=255)
    
    def __str__(self):
        return f"{self.hostname} ({self.event.name})"