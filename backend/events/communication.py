import logging
import os
import requests
from django.contrib import admin
from dotenv import load_dotenv
from .models import Participant, ParticipantEvent, Event

load_dotenv()

MJ_APIKEY_PUBLIC = os.getenv("MJ_APIKEY_PUBLIC")
MJ_APIKEY_PRIVATE = os.getenv("MJ_APIKEY_PRIVATE")
EMAIL_SENDER = os.getenv("EMAIL_SENDER")


def send_emails(event_id, participant_ids=None):
    """
    Send emails to participants of an event.

    Args:
        event_id: ID of the event
        participant_ids: List of participant IDs to send emails to. If None, sends to all participants.

    Returns:
        dict: Dictionary with 'success' boolean and 'sent' count or 'error' message
    """
    logger = logging.getLogger(__name__)

    try:
        # Obtener el evento
        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            return {"success": False, "error": "Evento no encontrado"}

        logger.info(f"Starting email sending for event: {event.id} - {event.name}")

        # Filtrar ParticipantEvent por los IDs seleccionados
        if participant_ids:
            participant_events = ParticipantEvent.objects.filter(
                event=event, participant_id__in=participant_ids
            ).select_related("participant")
        else:
            participant_events = ParticipantEvent.objects.filter(
                event=event
            ).select_related("participant")

        logger.info(f"Participants found: {participant_events.count()}")

        if not participant_events.exists():
            return {
                "success": False,
                "error": "No hay participantes para enviar correo",
            }

        # Construir mensajes para Mailjet
        messages = []
        for pe in participant_events:
            participant = pe.participant
            messages.append(
                {
                    "From": {
                        "Email": EMAIL_SENDER,
                        "Name": "AdministradorMonitoreo Application",
                    },
                    "To": [{"Email": participant.email}],
                    "Subject": f"Credenciales para el evento {event.name}",
                    "HTMLPart": f"Clave única de acceso: <b>{pe.event_key}</b>",
                }
            )
            logger.info(f"Prepared email for: {participant.email}")

        if messages:
            mailjet_url = "https://api.mailjet.com/v3.1/send"
            auth = (MJ_APIKEY_PUBLIC, MJ_APIKEY_PRIVATE)

            response = requests.post(
                mailjet_url, auth=auth, json={"Messages": messages}
            )

            logger.info(f"Mailjet response: {response.status_code} - {response.text}")

            if not response.ok:
                return {
                    "success": False,
                    "error": f"Error al enviar correos: {response.text}",
                }

        return {"success": True, "sent": len(messages)}

    except Exception as e:
        logger.error(f"Critical error: {str(e)}", exc_info=True)
        return {"success": False, "error": str(e)}
