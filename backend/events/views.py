from django.utils import timezone
from datetime import timedelta, datetime
from django.http import JsonResponse, HttpRequest
import json
import random
from events.communication import send_bulk_emails
from .models import Event, Participant, ParticipantLog
from django.views.decorators.csrf import csrf_exempt
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q


def check_event_time(event):
    now = timezone.now()
    if event.start_date and event.end_date:
        earliest_join_time = event.start_date - timedelta(minutes=1)
        return earliest_join_time <= now <= event.end_date
    return False


def verify_event_key(request):
    authorization = request.headers.get("Authorization", "")

    if not authorization.startswith("Bearer "):
        return JsonResponse({"error": "Invalid format authorization"}, status=401)

    event_key = authorization.split(" ")[1]
    try:
        participant = Participant.objects.select_related("event").get(
            event_key=event_key
        )
        event = participant.event
        dateIsValid = check_event_time(event)
        return JsonResponse(
            {
                "isValid": True,
                "dateIsValid": dateIsValid,
                "participant": {"name": participant.name, "email": participant.email},
                "event": {"name": event.name, "id": event.id},
            }
        )
    except Participant.DoesNotExist:
        return JsonResponse({"isValid": False}, status=404)


def get_participant(event_key):
    try:
        return Participant.objects.get(event_key=event_key)
    except Participant.DoesNotExist:
        return None


def log_participant_http_event(request: HttpRequest):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        event_key = request.headers.get("Authorization").split()[1]
        participant = get_participant(event_key)

        if not participant:
            return JsonResponse({"error": "Participant not found"}, status=404)

        ParticipantLog.objects.create(
            name="http", message=data["uri"], participant=participant
        )
        return JsonResponse({"status": "success"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


def log_participant_keylogger_event(request: HttpRequest):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        data = json.loads(request.body)
        event_key = request.headers.get("Authorization").split()[1]
        participant = get_participant(event_key)

        if not participant:
            return JsonResponse({"error": "Participant not found"}, status=404)

        ParticipantLog.objects.create(
            name="keylogger", message="\n".join(data["keys"]), participant=participant
        )
        return JsonResponse({"status": "success"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


def log_participant_screen_event(request: HttpRequest):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        event_key = request.headers.get("Authorization").split()[1]
        participant = get_participant(event_key)

        if not participant:
            return JsonResponse({"error": "Participant not found"}, status=404)

        file = request.FILES["screenshot"]
        ParticipantLog.objects.create(
            name="screen",
            file=file,
            message="Desktop Screenshot",
            participant=participant,
        )
        return JsonResponse({"status": "success"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


def log_participant_audio_video_event(request: HttpRequest):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        event_key = request.headers.get("Authorization").split()[1]
        participant = get_participant(event_key)

        if not participant:
            return JsonResponse({"error": "Participant not found"}, status=404)

        file = request.FILES["media"]
        ParticipantLog.objects.create(
            name="audio/video",
            file=file,
            message="Media Capture",
            participant=participant,
        )
        return JsonResponse({"status": "success"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


def trigger_emails(request, event_id):
    try:
        send_bulk_emails(
            event_id=event_id,
            subject="Nuevo comunicado del evento",
            body="<h1>Contenido importante del evento</h1>",
        )
        return JsonResponse({"status": "Correos enviados exitosamente"})
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
def participant_list_create(request):
    """Endpoint para listar y crear candidatos/participantes"""

    if request.method == "GET":
        # Obtener todos los participantes
        participants = (
            Participant.objects.all().select_related("event").order_by("-created_at")
        )

        # Filtrar por búsqueda si se proporciona un término
        search_term = request.GET.get("search", "")
        if search_term:
            participants = participants.filter(
                Q(name__icontains=search_term)
                | Q(email__icontains=search_term)
                | Q(position__icontains=search_term)
            )

        # Preparar los datos para la respuesta
        participants_data = []
        for participant in participants:
            event_code = ""
            if participant.event:
                event_code = participant.event.code or f"EVT-{participant.event.id:03d}"

            # Asignar un color según el ID (para la UI)
            colors = ["blue", "green", "purple", "red", "yellow", "indigo", "pink"]
            color = f"bg-{colors[participant.id % len(colors)]}-200"

            participants_data.append(
                {
                    "id": participant.id,
                    "name": participant.name,
                    "email": participant.email,
                    "position": participant.position or "",
                    "status": participant.get_status_display()
                    or "Pendiente",  # Mostrar el valor legible del estado
                    "event": event_code,
                    "eventId": participant.event_id,
                    "initials": participant.get_initials(),
                    "color": color,
                    "skills": (
                        participant.skills.split(",") if participant.skills else []
                    ),
                    "experienceYears": participant.experience_years or 0,
                    "notes": participant.notes or "",
                }
            )

        return JsonResponse({"participants": participants_data})

    elif request.method == "POST":
        try:
            # Crear un nuevo participante
            data = json.loads(request.body)

            # Validar campos obligatorios
            required_fields = ["nombre", "apellidos", "correo"]
            for field in required_fields:
                if not data.get(field):
                    return JsonResponse(
                        {"error": f'El campo "{field}" es obligatorio'}, status=400
                    )

            # Obtener o procesar evento (ahora es opcional)
            event = None
            if data.get("evento"):
                try:
                    event_id = data.get("evento")
                    event = Event.objects.get(id=event_id)
                except Event.DoesNotExist:
                    return JsonResponse({"error": "Evento no encontrado"}, status=404)

            # Procesar habilidades
            skills = data.get("habilidades", [])
            if isinstance(skills, list):
                skills_str = ",".join(skills)
            else:
                skills_str = str(skills)

            # Crear el participante
            first_name = data.get("nombre", "")
            last_name = data.get("apellidos", "")
            full_name = f"{first_name} {last_name}".strip()

            participant = Participant.objects.create(
                first_name=first_name,
                last_name=last_name,
                name=full_name,
                email=data.get("correo", ""),
                position=data.get("puesto", ""),
                experience_years=data.get("experiencia", None),
                skills=skills_str,
                notes=data.get("notas", ""),
                event=event,
                status="activo",  # Estado por defecto al crear
                send_credentials=data.get("configuracion", {}).get(
                    "enviarCredenciales", True
                ),
                send_reminder=data.get("configuracion", {}).get(
                    "enviarRecordatorio", True
                ),
            )

            # Responder con éxito
            return JsonResponse(
                {
                    "id": participant.id,
                    "name": participant.name,
                    "message": "Candidato creado exitosamente",
                }
            )

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def participant_detail(request, participant_id):
    """Endpoint para obtener, actualizar o eliminar un participante específico"""
    try:
        participant = Participant.objects.select_related("event").get(id=participant_id)
    except Participant.DoesNotExist:
        return JsonResponse({"error": "Candidato no encontrado"}, status=404)

    if request.method == "GET":
        # Obtener detalles del participante
        event_code = ""
        if participant.event:
            event_code = participant.event.code or f"EVT-{participant.event.id:03d}"

        # Preparar respuesta
        participant_data = {
            "id": participant.id,
            "nombre": participant.first_name,
            "apellidos": participant.last_name,
            "name": participant.name,
            "email": participant.email,
            "position": participant.position or "",
            "experienceYears": participant.experience_years or 0,
            "skills": participant.skills.split(",") if participant.skills else [],
            "notes": participant.notes or "",
            "status": participant.get_status_display(),
            "statusKey": participant.status,
            "event": event_code,
            "eventId": participant.event_id,
            "sendCredentials": participant.send_credentials,
            "sendReminder": participant.send_reminder,
            "initials": participant.get_initials(),
            "eventKey": participant.event_key,
            "isActive": participant.is_active,
            "createdAt": participant.created_at,
            "updatedAt": participant.updated_at,
        }

        return JsonResponse({"participant": participant_data})

    elif request.method == "PUT":
        try:
            # Actualizar el participante
            data = json.loads(request.body)

            # Add debugging
            print("Received data for update:", data)

            # Actualizar campos básicos
            if "nombre" in data:
                participant.first_name = data.get("nombre", participant.first_name)
                # Also update the last name if it exists
                if "apellidos" in data:
                    participant.last_name = data.get("apellidos", participant.last_name)
                participant.name = (
                    f"{participant.first_name} {participant.last_name}".strip()
                )

            if "correo" in data:
                participant.email = data.get("correo", participant.email)

            if "puesto" in data:
                print(
                    f"Updating position from '{participant.position}' to '{data.get('puesto')}'"
                )
                participant.position = data.get("puesto", participant.position)

            if "experiencia" in data:
                participant.experience_years = data.get(
                    "experiencia", participant.experience_years
                )

            # Procesar habilidades
            if "habilidades" in data:
                skills = data.get("habilidades", [])
                if isinstance(skills, list):
                    participant.skills = ",".join(skills)
                else:
                    participant.skills = str(skills)

            if "notas" in data:
                participant.notes = data.get("notas", participant.notes)

            if "status" in data:
                participant.status = data.get("status", participant.status)

            if "evento" in data:
                try:
                    event_id = data.get("evento")
                    event = Event.objects.get(id=event_id)
                    participant.event = event
                except Event.DoesNotExist:
                    return JsonResponse({"error": "Evento no encontrado"}, status=404)

            if "configuracion" in data:
                config = data.get("configuracion", {})
                participant.send_credentials = config.get(
                    "enviarCredenciales", participant.send_credentials
                )
                participant.send_reminder = config.get(
                    "enviarRecordatorio", participant.send_reminder
                )

            # Guardar cambios
            participant.save()
            print(
                f"Participant updated successfully. New position: {participant.position}"
            )

            return JsonResponse(
                {"message": "Candidato actualizado exitosamente", "id": participant.id}
            )

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        # Eliminar participante
        try:
            participant_name = participant.name
            participant.delete()
            return JsonResponse(
                {"message": f'Candidato "{participant_name}" eliminado exitosamente'}
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def participant_status_update(request, participant_id):
    """Endpoint para actualizar únicamente el estado de un participante"""
    try:
        participant = Participant.objects.get(id=participant_id)
    except Participant.DoesNotExist:
        return JsonResponse({"error": "Candidato no encontrado"}, status=404)

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            status = data.get("status")

            if status in [s[0] for s in Participant.STATUS_CHOICES]:
                participant.status = status
                participant.save(update_fields=["status", "updated_at"])

                return JsonResponse(
                    {
                        "message": "Estado actualizado exitosamente",
                        "status": participant.get_status_display(),
                    }
                )
            else:
                return JsonResponse({"error": "Estado no válido"}, status=400)

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def event_list_create(request):
    if request.method == "GET":
        # Listar todos los eventos
        events = Event.objects.all().order_by("-start_date")
        events_data = []

        for event in events:
            participant_count = Participant.objects.filter(event=event).count()

            # Formatear fecha y hora para el frontend
            date_str = event.start_date.strftime("%d/%m/%Y") if event.start_date else ""
            time_str = event.start_date.strftime("%H:%M %p") if event.start_date else ""
            duration_str = f"{event.duration} minutos" if event.duration else ""

            # Mapear estado interno a formato de presentación
            status_mapping = {
                "programado": "Programado",
                "en_progreso": "En progreso",
                "completado": "Completado",
                "cancelado": "Cancelado",
            }

            display_status = status_mapping.get(event.status, "Programado")

            events_data.append(
                {
                    "id": event.id,
                    "code": event.code or f"EVT-{event.id:03d}",
                    "name": event.name,
                    "date": date_str,
                    "time": time_str,
                    "duration": duration_str,
                    "participants": participant_count,
                    "status": display_status,
                    "description": event.description,
                    "evaluator": event.evaluator,
                    "event_type": event.event_type,
                    "camera_enabled": event.camera_enabled,
                    "mic_enabled": event.mic_enabled,
                    "screen_enabled": event.screen_enabled,
                    "start_date": event.start_date,
                    "end_date": event.end_date,
                }
            )

        return JsonResponse({"events": events_data})

    elif request.method == "POST":
        # Crear un nuevo evento
        try:
            data = json.loads(request.body)

            # Convertir la fecha y hora a datetime
            start_date_str = data.get("startDate", "")
            start_time_str = data.get("startTime", "")

            if start_date_str and start_time_str:
                start_datetime_str = f"{start_date_str} {start_time_str}"
                start_datetime = datetime.strptime(start_datetime_str, "%Y-%m-%d %H:%M")

                # Calcular end_date basado en start_date y duration
                duration_minutes = int(data.get("duration", 60))
                end_datetime = start_datetime + timedelta(minutes=duration_minutes)
            else:
                start_datetime = None
                end_datetime = None

            # Verificar que haya al menos un participante seleccionado
            candidates = data.get("candidates", [])
            selected_candidates = [c for c in candidates if c.get("selected", False)]

            if not selected_candidates:
                return JsonResponse(
                    {"error": "Debe seleccionar al menos un participante"}, status=400
                )

            # Crear el evento
            new_event = Event.objects.create(
                name=data.get("eventName", ""),
                description=data.get("description", ""),
                start_date=start_datetime,
                end_date=end_datetime,
                duration=int(data.get("duration", 60)),
                event_type=data.get("evaluationType", "tecnica"),
                evaluator=data.get("evaluator", ""),
                camera_enabled=data.get("cameraEnabled", True),
                mic_enabled=data.get("micEnabled", True),
                screen_enabled=data.get("screenEnabled", True),
                status="programado",
            )

            # Procesar los candidatos seleccionados
            for candidate_data in selected_candidates:
                if candidate_data.get("id"):
                    # Si el candidato ya existe, actualizamos su evento
                    try:
                        participant = Participant.objects.get(
                            id=candidate_data.get("id")
                        )
                        participant.event = new_event
                        participant.is_active = True
                        participant.save()
                    except Participant.DoesNotExist:
                        # Si no existe, lo creamos
                        participant = Participant.objects.create(
                            name=candidate_data.get("name", ""),
                            email=candidate_data.get("email", ""),
                            event=new_event,
                            is_active=True,
                        )
                else:
                    # Si es un candidato nuevo
                    participant = Participant.objects.create(
                        name=candidate_data.get("name", ""),
                        email=candidate_data.get("email", ""),
                        event=new_event,
                        is_active=True,
                    )

            return JsonResponse({"success": True, "eventId": new_event.id})

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def event_detail(request, event_id):
    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return JsonResponse({"error": "Evento no encontrado"}, status=404)

    if request.method == "GET":
        # Obtener detalles del evento
        participants = Participant.objects.filter(event=event)
        participants_data = [
            {
                "id": participant.id,
                "name": participant.name,
                "email": participant.email,
                "is_active": participant.is_active,
                "event_key": participant.event_key,
                "status": participant.status,
                "position": participant.position,
                "initials": participant.get_initials(),
                "color": f"bg-{['blue', 'green', 'purple', 'red', 'yellow', 'indigo', 'pink'][participant.id % 7]}-200",
            }
            for participant in participants
        ]

        # Formatear fecha y hora para el frontend
        date_str = event.start_date.strftime("%d/%m/%Y") if event.start_date else ""
        time_str = event.start_date.strftime("%H:%M") if event.start_date else ""

        event_data = {
            "id": event.id,
            "code": event.code or f"EVT-{event.id:03d}",
            "name": event.name,
            "description": event.description,
            "date": date_str,
            "time": time_str,
            "startDate": (
                event.start_date.strftime("%Y-%m-%d") if event.start_date else ""
            ),
            "startTime": event.start_date.strftime("%H:%M") if event.start_date else "",
            "duration": event.duration,
            "evaluationType": event.event_type,
            "evaluator": event.evaluator,
            "cameraEnabled": event.camera_enabled,
            "micEnabled": event.mic_enabled,
            "screenEnabled": event.screen_enabled,
            "status": event.status,
            "participants": participants_data,
        }

        return JsonResponse({"event": event_data})

    elif request.method == "PUT":
        # Actualizar un evento existente
        try:
            # Log the received data for debugging
            print(f"Updating event {event_id}")
            data = json.loads(request.body)
            print(f"Received data: {data}")

            # Convertir la fecha y hora a datetime
            start_date_str = data.get("startDate", "")
            start_time_str = data.get("startTime", "")

            print(f"Date: {start_date_str}, Time: {start_time_str}")

            if start_date_str and start_time_str:
                try:
                    start_datetime_str = f"{start_date_str} {start_time_str}"
                    print(f"Parsing datetime: {start_datetime_str}")

                    # Try different formats if needed
                    try:
                        start_datetime = datetime.strptime(
                            start_datetime_str, "%Y-%m-%d %H:%M"
                        )
                    except ValueError:
                        # Try another common format
                        start_datetime = datetime.strptime(
                            start_datetime_str, "%d/%m/%Y %H:%M"
                        )

                    # Calcular end_date basado en start_date y duration
                    try:
                        duration_minutes = int(float(data.get("duration", 60)))
                    except (ValueError, TypeError):
                        duration_minutes = 60  # Default if conversion fails

                    end_datetime = start_datetime + timedelta(minutes=duration_minutes)

                    print(
                        f"Start datetime: {start_datetime}, End datetime: {end_datetime}"
                    )

                    event.start_date = start_datetime
                    event.end_date = end_datetime
                except Exception as date_error:
                    print(f"Date parsing error: {date_error}")
                    # Don't update dates if there's an error

            # Actualizar los campos del evento
            event.name = data.get("eventName", event.name)
            event.description = data.get("description", event.description)

            try:
                duration_value = data.get("duration")
                if duration_value:
                    event.duration = int(float(duration_value))
            except (ValueError, TypeError):
                # Keep existing duration if conversion fails
                pass

            event.event_type = data.get("evaluationType", event.event_type)
            event.evaluator = data.get("evaluator", event.evaluator)

            # Use explicit boolean conversion to handle different formats
            camera_enabled = data.get("cameraEnabled")
            if camera_enabled is not None:
                event.camera_enabled = bool(camera_enabled)

            mic_enabled = data.get("micEnabled")
            if mic_enabled is not None:
                event.mic_enabled = bool(mic_enabled)

            screen_enabled = data.get("screenEnabled")
            if screen_enabled is not None:
                event.screen_enabled = bool(screen_enabled)

            # Save event changes
            event.save()

            # Handle candidates if provided
            if "candidates" in data:
                try:
                    handle_event_candidates(event, data.get("candidates", []))
                except Exception as candidate_error:
                    print(f"Error processing candidates: {candidate_error}")
                    # Continue even if candidate processing fails

            return JsonResponse({"success": True})
        except Exception as e:
            print(f"Error updating event: {e}")
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        # Eliminar un evento
        try:
            event.delete()
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


def handle_event_candidates(event, candidates):
    """Helper function to process candidates for an event"""
    current_participants = {p.email: p for p in Participant.objects.filter(event=event)}

    # Get emails of selected candidates
    selected_emails = {c["email"] for c in candidates if c.get("selected", False)}
    existing_emails = set(current_participants.keys())

    # Emails to add and remove
    emails_to_add = selected_emails - existing_emails
    emails_to_remove = existing_emails - selected_emails

    print(
        f"Adding {len(emails_to_add)} new participants, removing {len(emails_to_remove)}"
    )

    # Create new participants
    for candidate in candidates:
        if candidate.get("email") in emails_to_add and candidate.get("selected", False):
            Participant.objects.create(
                name=candidate.get("name", ""),
                email=candidate.get("email", ""),
                event=event,
                is_active=True,
            )

    # Remove participants no longer selected
    for email in emails_to_remove:
        current_participants[email].delete()
