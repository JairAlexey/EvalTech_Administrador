import logging
import os
import requests
from django.contrib import admin
from dotenv import load_dotenv
from .models import Participant

load_dotenv()  

MJ_APIKEY_PUBLIC = os.getenv("MJ_APIKEY_PUBLIC")
MJ_APIKEY_PRIVATE = os.getenv("MJ_APIKEY_PRIVATE")
EMAIL_SENDER = os.getenv("EMAIL_SENDER")

def send_bulk_emails(event_id: int, subject: str, body: str):
    """
    Sends bulk emails to all participants of an event.
    Args:
        event_id: Event ID
        subject: Email subject
        body: Email HTML content
    """
    # Get all participants of the event
    participants = Participant.objects.filter(event_id=event_id)
    
    if not participants.exists():
        raise ValueError("The event has no registered participants")

    emails = [participant.email for participant in participants]
    
    # Configure Mailjet API
    mailjet_url = "https://api.mailjet.com/v3.1/send"
    auth = (MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE)
    
    # Send in batches of 50 (Mailjet limit)
    batch_size = 50
    for i in range(0, len(emails), batch_size):
        batch_emails = emails[i:i + batch_size]
        
        messages = [
            {
                "From": {
                    "Email": EMAIL_SENDER,
                    "Name": "AdministradorMonitoreo Application",
                },
                "To": [{"Email": email}],
                "Subject": subject,
                "HTMLPart": body,
            }
            for email in batch_emails
        ]

        response = requests.post(
            mailjet_url,
            auth=auth,
            json={"Messages": messages}
        )
        
        print(f"Mailjet response: {response.status_code} - {response.text}")  # Depuración

        if not response.ok:
            raise Exception(f"Error sending emails: {response.text}")
        

@admin.action(description="Send email to participants")
def send_emails(modeladmin, request, queryset):
    logger = logging.getLogger(__name__)
    
    for event in queryset:
        try:
            logger.info(f"Starting email sending for event: {event.id} - {event.name}")
            
            participants = Participant.objects.filter(event=event)
            logger.info(f"Participants found: {participants.count()}")

            # Lista de emails con su respectiva clave única
            messages = []
            for participant in participants:
                messages.append({
                    "From": {
                        "Email": EMAIL_SENDER,
                        "Name": "AdministradorMonitoreo Application",
                    },
                    "To": [{"Email": participant.email}],
                    "Subject": f"Event credentials for {event.name}",
                    "HTMLPart": f"Key: {participant.event_key}",
                })
                logger.info(f"Prepared email for: {participant.email}")

            if messages:
                mailjet_url = "https://api.mailjet.com/v3.1/send"
                auth = (MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE)

                response = requests.post(
                    mailjet_url,
                    auth=auth,
                    json={"Messages": messages}
                )

                logger.info(f"Mailjet response: {response.status_code} - {response.text}")

                if not response.ok:
                    raise Exception(f"Error sending emails: {response.text}")

            modeladmin.message_user(request, "Emails sent")
        
        except Exception as e:
            logger.error(f"Critical error: {str(e)}", exc_info=True)
            modeladmin.message_user(request, f"Error: {str(e)}", level='ERROR')
