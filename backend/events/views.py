from django.utils import timezone
from datetime import timedelta, datetime
from django.http import JsonResponse, HttpRequest
import json, re
from events.communication import send_bulk_emails
from .models import Event, Participant, ParticipantLog, Website, BlockedHost
from django.views.decorators.csrf import csrf_exempt
from django.core.serializers.json import DjangoJSONEncoder
from django.db.models import Q
from zoneinfo import ZoneInfo
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Q
from django.db.models.deletion import RestrictedError
from authentication.models import CustomUser


def check_event_time(event):
    now = timezone.now()
    if event.start_date and event.end_date:
        earliest_join_time = event.start_date - timedelta(minutes=1)
        return earliest_join_time <= now <= event.end_date
    return False


def is_valid_domain(domain):
    # Expresión regular básica para dominios (no URLs completas)
    pattern = r"^(?!\-)([A-Za-z0-9\-]{1,63}(?<!\-)\.)+[A-Za-z]{2,}$"
    return re.match(pattern, domain) is not None


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
    if request.method == "POST":
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
def participants(request):
    """Endpoint para listar y crear participantes"""

    if request.method == "GET":
        # Obtener todos los participantes
        participants = (
            Participant.objects.all().prefetch_related("events").order_by("-created_at")
        )

        # Filtrar por búsqueda si se proporciona un término
        search_term = request.GET.get("search", "")
        if search_term:
            participants = participants.filter(
                Q(name__icontains=search_term) | Q(email__icontains=search_term)
            )

        # Preparar los datos para la respuesta
        participants_data = []
        for participant in participants:
            # Asignar un color según el ID (para la UI)
            colors = ["blue", "green", "purple", "red", "yellow", "indigo", "pink"]
            color = f"bg-{colors[participant.id % len(colors)]}-200"

            # Obtener eventos relacionados
            events_data = [
                {
                    "id": event.id,
                    "name": event.name,
                    "date": (
                        event.start_date.strftime("%d/%m/%Y")
                        if event.start_date
                        else ""
                    ),
                    "status": event.status,
                }
                for event in participant.events.all()
            ]

            participants_data.append(
                {
                    "id": participant.id,
                    "name": participant.name,
                    "email": participant.email,
                    "initials": participant.get_initials(),
                    "color": color,
                    "events": events_data,
                }
            )

        return JsonResponse({"participants": participants_data})

    elif request.method == "POST":
        try:
            # Crear un nuevo participante
            data = json.loads(request.body)

            # Definir variables
            first_name = data.get("first_name", "").strip()
            last_name = data.get("last_name", "").strip()
            email = data.get("email", "").strip()
            full_name = f"{first_name} {last_name}".strip()

            # Validar campos obligatorios
            if not first_name:
                return JsonResponse(
                    {"error": 'El campo "nombre" es obligatorio'}, status=400
                )
            if not last_name:
                return JsonResponse(
                    {"error": 'El campo "apellidos" es obligatorio'}, status=400
                )
            if not email:
                return JsonResponse(
                    {"error": 'El campo "correo" es obligatorio'}, status=400
                )

            # Validar formato de email
            try:
                validate_email(email)
            except ValidationError:
                return JsonResponse({"error": "El correo no es válido"}, status=400)

            # Validar unicidad de email
            if Participant.objects.filter(email__iexact=email).exists():
                return JsonResponse(
                    {"error": "Ya existe un participante con ese correo"}, status=400
                )

            # Crear el participante
            participant = Participant.objects.create(
                first_name=first_name,
                last_name=last_name,
                name=full_name,
                email=email,
            )

            # Responder con éxito
            return JsonResponse(
                {
                    "id": participant.id,
                    "name": participant.name,
                    "message": "Participante creado exitosamente",
                }
            )

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def participant_detail(request, participant_id):
    """Endpoint para obtener, actualizar o eliminar un participante específico"""
    try:
        participant = Participant.objects.get(id=participant_id)
    except Participant.DoesNotExist:
        return JsonResponse({"error": "Participante no encontrado"}, status=404)

    if request.method == "GET":
        # Preparar respuesta
        participant_data = {
            "id": participant.id,
            "first_name": participant.first_name,
            "last_name": participant.last_name,
            "email": participant.email,
        }

        return JsonResponse({"participant": participant_data})

    elif request.method == "PUT":
        try:
            # Actualizar el participante
            data = json.loads(request.body)
            changed = False

            # Validar campos obligatorios
            first_name = data.get("first_name", "").strip()
            last_name = data.get("last_name", "").strip()
            email = data.get("email", "").strip()
            full_name = f"{first_name} {last_name}".strip()

            if not first_name:
                return JsonResponse(
                    {"error": 'El campo "nombre" es obligatorio'}, status=400
                )
            if not last_name:
                return JsonResponse(
                    {"error": 'El campo "apellidos" es obligatorio'}, status=400
                )
            if not email:
                return JsonResponse(
                    {"error": 'El campo "correo" es obligatorio'}, status=400
                )

            # Validar formato de email
            try:
                validate_email(email)
            except ValidationError:
                return JsonResponse({"error": "El correo no es válido"}, status=400)

            # Validar unicidad de email (excepto el propio participante)
            if (
                Participant.objects.filter(email__iexact=email)
                .exclude(id=participant.id)
                .exists()
            ):
                return JsonResponse(
                    {"error": "Ya existe un participante con ese correo"}, status=400
                )

            # Solo actualizar si cambió el valor
            if participant.first_name != first_name:
                participant.first_name = first_name
                changed = True
            if participant.last_name != last_name:
                participant.last_name = last_name
                changed = True
            if participant.name != full_name:
                participant.name = full_name
                changed = True
            if participant.email != email:
                participant.email = email
                changed = True

            if changed:
                participant.save()

            return JsonResponse(
                {
                    "message": "Participante actualizado exitosamente",
                    "id": participant.id,
                }
            )

        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        # Eliminar participante
        try:
            participant_name = participant.name
            participant.delete()
            return JsonResponse(
                {"message": f'Participante "{participant_name}" eliminado exitosamente'}
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def events(request):
    if request.method == "GET":
        # Listar todos los eventos
        events = Event.objects.all().order_by("-start_date")
        events_data = []

        for event in events:
            participant_count = Participant.objects.filter(events=event).count()

            # Formatear fecha y hora para el frontend
            date_str = event.start_date.strftime("%d/%m/%Y") if event.start_date else ""
            time_str = event.start_date.strftime("%H:%M %p") if event.start_date else ""
            close_date_str = (
                event.close_date.strftime("%d/%m/%Y") if event.close_date else ""
            )
            close_time_str = (
                event.close_date.strftime("%H:%M %p") if event.close_date else ""
            )

            # Mapear estado interno a formato de presentación
            status_mapping = {
                "programado": "Programado",
                "en_progreso": "En progreso",
                "completado": "Completado",
                "cancelado": "Cancelado",
            }

            display_status = status_mapping.get(event.status, "Programado")

            # Serializar el evaluador como diccionario en lugar del objeto completo
            evaluator_data = None
            if event.evaluator:
                evaluator_data = (
                    f"{event.evaluator.first_name} {event.evaluator.last_name}"
                )

            events_data.append(
                {
                    "id": event.id,
                    "name": event.name,
                    "startDate": date_str,
                    "startTime": time_str,
                    "closeDate": close_date_str,
                    "closeTime": close_time_str,
                    "participants": participant_count,
                    "status": display_status,
                    "evaluator": evaluator_data,
                }
            )

        return JsonResponse({"events": events_data})

    elif request.method == "POST":
        # Crear un nuevo evento
        try:
            data = json.loads(request.body)

            # =======================
            # Validaciones
            # =======================
            field_names = {
                "eventName": "nombre del evento",
                "description": "descripción",
                "startDate": "fecha de inicio",
                "startTime": "hora de inicio",
                "closeTime": "fecha de fin",
                "evaluator": "evaluador",
            }

            # Validar campos
            for field in field_names:
                if not data.get(field):
                    return JsonResponse(
                        {
                            "error": f"El campo {field_names.get(field, field)} es obligatorio"
                        },
                        status=400,
                    )

            # Validar nombre de evento único y longitud mínima
            event_name = data.get("eventName", "").strip()
            if Event.objects.filter(name__iexact=event_name).exists():
                return JsonResponse(
                    {"error": "Ya existe un evento con ese nombre"}, status=400
                )
            if len(event_name) < 4:
                return JsonResponse(
                    {"error": "El nombre del evento debe tener al menos 4 caracteres"},
                    status=400,
                )

            # Validar descripción mínima
            description = data.get("description", "")
            if len(description.strip()) < 5:
                return JsonResponse(
                    {"error": "La descripción debe tener al menos 5 caracteres"},
                    status=400,
                )

            # Duración
            try:
                duration_minutes = int(float(data.get("duration", 30)))
                if duration_minutes < 30:
                    return JsonResponse(
                        {"error": "La duración debe ser mayor o igual a 30 minutos"},
                        status=400,
                    )
            except (ValueError, TypeError):
                return JsonResponse({"error": "Duración inválida"}, status=400)

            # =======================
            # Validar fechas y horas
            # =======================
            tz_str = (data.get("timezone") or "").strip() or "America/Guayaquil"
            try:
                user_tz = ZoneInfo(tz_str)
            except Exception:
                user_tz = ZoneInfo("America/Guayaquil")

            start_date_str = data.get("startDate", "")
            start_time_str = data.get("startTime", "")
            close_time_str = data.get("closeTime", "")

            # Parsear fecha y hora de inicio
            try:
                start_naive = datetime.strptime(
                    f"{start_date_str} {start_time_str}", "%Y-%m-%d %H:%M"
                )
            except ValueError:
                try:
                    start_naive = datetime.strptime(
                        f"{start_date_str} {start_time_str}", "%d/%m/%Y %H:%M"
                    )
                except ValueError:
                    return JsonResponse(
                        {"error": "Formato de fecha/hora de inicio inválido"},
                        status=400,
                    )

            # Parsear hora de cierre (mismo día)
            try:
                close_naive = datetime.strptime(
                    f"{start_date_str} {close_time_str}", "%Y-%m-%d %H:%M"
                )
            except ValueError:
                try:
                    close_naive = datetime.strptime(
                        f"{start_date_str} {close_time_str}", "%d/%m/%Y %H:%M"
                    )
                except ValueError:
                    return JsonResponse(
                        {"error": "Formato de hora de cierre inválido"}, status=400
                    )

            # Convertir a zona horaria del usuario
            start_local = timezone.make_aware(start_naive, user_tz)
            close_local = timezone.make_aware(close_naive, user_tz)

            # Validar que la fecha/hora de inicio sea mayor a la actual en la zona del usuario
            now_local = timezone.localtime(timezone.now(), user_tz).replace(
                second=0, microsecond=0
            )
            if start_local <= now_local:
                return JsonResponse(
                    {
                        "error": "La fecha y hora de inicio deben ser mayor a la fecha y hora actual"
                    },
                    status=400,
                )

            # Validar que la hora de cierre sea al menos 5 minutos después de la hora de inicio
            min_close_local = start_local + timedelta(minutes=5)
            if close_local < min_close_local:
                return JsonResponse(
                    {
                        "error": "La hora de cierre debe ser al menos 5 minutos después de la hora de inicio"
                    },
                    status=400,
                )

            # Convertir a UTC para guardar en la BD
            start_utc = start_local.astimezone(ZoneInfo("UTC"))
            close_utc = close_local.astimezone(ZoneInfo("UTC"))

            # =======================
            # 2) Participantes (opcional)
            # =======================
            participants = data.get("participants", [])
            selected_participants = [
                c for c in participants if c.get("selected", False)
            ]

            # =======================
            # 3) Crear evento
            # =======================

            evaluator_id = data.get("evaluator", "")

            # Obtener la instancia del evaluador
            try:
                evaluator_instance = CustomUser.objects.get(id=evaluator_id)
            except CustomUser.DoesNotExist:
                return JsonResponse(
                    {"error": "El evaluador seleccionado no existe"}, status=400
                )

            # Validar que el evaluador no tenga otro evento ese día
            # Calcular el rango UTC que corresponde al día local del usuario
            start_of_day_local = start_local.replace(
                hour=0, minute=0, second=0, microsecond=0
            )
            end_of_day_local = start_of_day_local + timedelta(days=1)

            start_of_day_utc = start_of_day_local.astimezone(ZoneInfo("UTC"))
            end_of_day_utc = end_of_day_local.astimezone(ZoneInfo("UTC"))

            evaluator_events_same_day = Event.objects.filter(
                evaluator=evaluator_instance,
                start_date__gte=start_of_day_utc,
                start_date__lt=end_of_day_utc,
            )
            if evaluator_events_same_day.exists():
                return JsonResponse(
                    {"error": "El evaluador ya está asignado a un evento ese día"},
                    status=400,
                )

            new_event = Event.objects.create(
                name=data.get("eventName", ""),
                description=data.get("description", ""),
                start_date=start_utc,
                close_date=close_utc,
                evaluator=evaluator_instance,
                status="programado",
            )

            # =======================
            # 4) Participantes (asociar a través de ManyToMany)
            # =======================
            for participant_data in selected_participants:
                cid = participant_data.get("id")
                if cid:
                    try:
                        participant = Participant.objects.get(id=cid)
                        new_event.participants.add(participant)
                    except Participant.DoesNotExist:
                        pass

            # Al final, después de crear el evento y asignar participantes:
            blocked_website_ids = data.get("blockedWebsites", [])
            if blocked_website_ids:
                for website_id in blocked_website_ids:
                    try:
                        website = Website.objects.get(id=website_id)
                        BlockedHost.objects.get_or_create(
                            event=new_event, website=website
                        )
                    except Website.DoesNotExist:
                        pass

            return JsonResponse({"success": True, "id": new_event.id})

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
        participants = Participant.objects.filter(events=event)
        participants_data = [
            {
                "id": participant.id,
                "name": participant.name,
                "email": participant.email,
                "initials": participant.get_initials(),
                "color": f"bg-{['blue', 'green', 'purple', 'red', 'yellow', 'indigo', 'pink'][participant.id % 7]}-200",
            }
            for participant in participants
        ]

        # Formatear fecha y hora para el frontend
        date_str = event.start_date.strftime("%d/%m/%Y") if event.start_date else ""
        time_str = event.start_date.strftime("%H:%M") if event.start_date else ""

        # Serializar el evaluador como string
        evaluator_name = None
        if event.evaluator:
            evaluator_name = f"{event.evaluator.first_name} {event.evaluator.last_name}"

        event_data = {
            "id": event.id,
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
            "evaluator": evaluator_name,
            "status": event.status,
            "participants": participants_data,
        }

        return JsonResponse({"event": event_data})

    elif request.method == "PUT":
        try:
            print(f"Updating event {event_id}")
            data = json.loads(request.body)
            print(f"Received data: {data}")

            changed = False  # Para guardar solo si hubo cambios

            # =======================
            # 1) Fecha/hora → UTC
            # =======================
            start_date_str = data.get("startDate", "")
            start_time_str = data.get("startTime", "")
            tz_str = (data.get("timezone") or "").strip() or "America/Guayaquil"

            print(f"Date: {start_date_str}, Time: {start_time_str}, TZ: {tz_str}")

            if start_date_str and start_time_str:
                try:
                    start_datetime_str = f"{start_date_str} {start_time_str}"
                    print(f"Parsing datetime: {start_datetime_str}")

                    # Parseo  de formatos comunes
                    try:
                        start_naive = datetime.strptime(
                            start_datetime_str, "%Y-%m-%d %H:%M"
                        )
                    except ValueError:
                        start_naive = datetime.strptime(
                            start_datetime_str, "%d/%m/%Y %H:%M"
                        )

                    # Zona horaria enviada por el front (IANA)
                    try:
                        user_tz = ZoneInfo(tz_str)
                    except Exception:
                        print(
                            f"Invalid timezone '{tz_str}', falling back to America/Guayaquil"
                        )
                        user_tz = ZoneInfo("America/Guayaquil")

                    # Aware en tz del usuario
                    start_local = timezone.make_aware(start_naive, user_tz)

                    # Duración (para end time)
                    try:
                        duration_minutes = int(float(data.get("duration", 60)))
                    except (ValueError, TypeError):
                        duration_minutes = 60

                    end_local = start_local + timedelta(minutes=duration_minutes)

                    # Convertir a UTC para guardar
                    start_utc = start_local.astimezone(ZoneInfo("UTC"))
                    end_utc = end_local.astimezone(ZoneInfo("UTC"))

                    print(f"Start UTC: {start_utc}, End UTC: {end_utc}")

                    if event.start_date != start_utc:
                        event.start_date = start_utc
                        changed = True
                    if event.end_date != end_utc:
                        event.end_date = end_utc
                        changed = True

                except Exception as date_error:
                    print(f"Date parsing error: {date_error}")

            # =======================
            # 2) Otros campos
            # =======================
            new_name = data.get("eventName")
            if new_name is not None and new_name != event.name:
                event.name = new_name
                changed = True

            new_description = data.get("description")
            if new_description is not None and new_description != event.description:
                event.description = new_description
                changed = True

            try:
                duration_value = data.get("duration")
                if duration_value is not None:
                    new_duration = int(float(duration_value))
                    if new_duration != event.duration:
                        event.duration = new_duration
                        changed = True
            except (ValueError, TypeError):
                pass  # Mantener duración existente

            new_event_type = data.get("evaluationType")
            if new_event_type is not None and new_event_type != event.event_type:
                event.event_type = new_event_type
                changed = True

            new_evaluator = data.get("evaluator")
            if new_evaluator is not None:
                try:
                    evaluator_instance = CustomUser.objects.get(id=new_evaluator)
                    if evaluator_instance != event.evaluator:
                        event.evaluator = evaluator_instance
                        changed = True
                except CustomUser.DoesNotExist:
                    return JsonResponse(
                        {"error": "El evaluador seleccionado no existe"}, status=400
                    )

            # =======================
            # 3) Guardar solo si cambió
            # =======================
            if changed:
                event.save()

            # =======================
            # 4) Participantes
            # =======================
            if "participants" in data:
                try:
                    handle_event_participants(event, data.get("participants", []))
                except Exception as participant_error:
                    print(f"Error processing participantes: {participant_error}")

            return JsonResponse({"success": True, "updated": changed})

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


def handle_event_participants(event, participants_payload):
    """
    Sin crear ni eliminar objetos Participant.
    Solo sincroniza la relación M2M Event <-> Participant
    en base a los items del payload con selected=True.

    participants_payload: lista de dicts del tipo:
        { "email": "a@b.com", "name": "...", "selected": true/false }
    """

    # Normalizar correos del payload
    def _norm(email):
        return (email or "").strip().lower()

    selected_emails = {
        _norm(item.get("email"))
        for item in (participants_payload or [])
        if item.get("selected", False) and item.get("email")
    }

    # Estado actual en BD
    current_participants = list(event.participants.all())
    current_emails = {p.email.lower() for p in current_participants}

    # A quién agregar / quitar (solo por email existente en BD)
    emails_to_add = selected_emails - current_emails
    emails_to_remove = current_emails - selected_emails

    # Traer solo los Participant existentes que corresponden a emails_to_add
    participants_to_add = list(
        Participant.objects.filter(email__in=list(emails_to_add))
    )

    # Map rápido por email
    current_by_email = {p.email.lower(): p for p in current_participants}

    with transaction.atomic():
        # Agregar asociaciones nuevas
        if participants_to_add:
            event.participants.add(*participants_to_add)

        # Quitar asociaciones que ya no están seleccionadas
        if emails_to_remove:
            to_remove = [
                current_by_email[e] for e in emails_to_remove if e in current_by_email
            ]
            if to_remove:
                event.participants.remove(*to_remove)

    # Métricas útiles para logs/debug
    added_count = len(participants_to_add)
    removed_count = len(emails_to_remove)
    skipped_emails = sorted(
        selected_emails
        - {p.email.lower() for p in participants_to_add}
        - current_emails
    )
    # `skipped_emails` = correos marcados como selected que NO existen en Participant,
    # y por política no se crean aquí.

    print(
        f"[handle_event_participants] Added: {added_count}, Removed: {removed_count}, "
        f"Skipped (not found in Participant): {len(skipped_emails)} -> {skipped_emails}"
    )

    return {
        "added": added_count,
        "removed": removed_count,
        "skipped_not_found": skipped_emails,
    }


@csrf_exempt
def blocked_pages(request):
    """Endpoint para listar y crear páginas bloqueadas"""

    if request.method == "GET":
        pages = BlockedPage.objects.all().order_by("-created_at")
        pages_data = [
            {
                "id": page.id,
                "domain": page.domain,
                "created_at": page.created_at.isoformat() if page.created_at else None,
            }
            for page in pages
        ]
        return JsonResponse({"blocked_pages": pages_data})

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            domain = data.get("domain", "").strip().lower()

            if not domain:
                return JsonResponse({"error": "El dominio es obligatorio"}, status=400)

            if BlockedPage.objects.filter(domain__iexact=domain).exists():
                return JsonResponse({"error": "Este dominio ya existe"}, status=400)

            page = BlockedPage.objects.create(domain=domain)

            return JsonResponse(
                {
                    "id": page.id,
                    "domain": page.domain,
                    "created_at": page.created_at.isoformat(),
                }
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def blocked_page_detail(request, page_id):
    """Endpoint para actualizar o eliminar una página bloqueada"""

    try:
        page = BlockedPage.objects.get(id=page_id)
    except BlockedPage.DoesNotExist:
        return JsonResponse({"error": "Página bloqueada no encontrada"}, status=404)

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            domain = data.get("domain", "").strip().lower()

            if not domain:
                return JsonResponse({"error": "El dominio es obligatorio"}, status=400)

            if (
                BlockedPage.objects.filter(domain__iexact=domain)
                .exclude(id=page_id)
                .exists()
            ):
                return JsonResponse({"error": "Este dominio ya existe"}, status=400)

            page.domain = domain
            page.save()

            return JsonResponse(
                {
                    "id": page.id,
                    "domain": page.domain,
                    "created_at": page.created_at.isoformat(),
                }
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        try:
            page.delete()
            return JsonResponse({"message": "Página bloqueada eliminada exitosamente"})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def websites(request):
    """Endpoint para listar y crear sitios web (páginas bloqueables)"""

    if request.method == "GET":
        sites = Website.objects.all().order_by("hostname")
        sites_data = [
            {
                "id": str(site.id),
                "hostname": site.hostname,
            }
            for site in sites
        ]
        return JsonResponse({"websites": sites_data})

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            hostname = data.get("hostname", "").strip().lower()

            if not hostname:
                return JsonResponse(
                    {"error": "El nombre del sitio es obligatorio"}, status=400
                )

            if not is_valid_domain(hostname):
                return JsonResponse(
                    {"error": "El nombre del sitio no es un dominio válido"}, status=400
                )

            if Website.objects.filter(hostname__iexact=hostname).exists():
                return JsonResponse({"error": "Este sitio web ya existe"}, status=400)

            website = Website.objects.create(hostname=hostname)

            return JsonResponse(
                {
                    "id": str(website.id),
                    "hostname": website.hostname,
                }
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def website_detail(request, website_id):
    """Endpoint para actualizar o eliminar un sitio web"""

    try:
        website = Website.objects.get(id=website_id)
    except Website.DoesNotExist:
        return JsonResponse({"error": "Sitio web no encontrado"}, status=404)

    if request.method == "PUT":
        try:
            data = json.loads(request.body)
            hostname = data.get("hostname", "").strip().lower()

            if not hostname:
                return JsonResponse(
                    {"error": "El nombre del sitio es obligatorio"}, status=400
                )

            if not is_valid_domain(hostname):
                return JsonResponse(
                    {"error": "El nombre del sitio no es un dominio válido"}, status=400
                )

            if (
                Website.objects.filter(hostname__iexact=hostname)
                .exclude(id=website_id)
                .exists()
            ):
                return JsonResponse({"error": "Este sitio web ya existe"}, status=400)

            website.hostname = hostname
            website.save()

            return JsonResponse(
                {
                    "id": str(website.id),
                    "hostname": website.hostname,
                }
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":
        try:
            website.delete()
            return JsonResponse({"message": "Sitio web eliminado exitosamente"})
        except RestrictedError as e:
            return JsonResponse(
                {"error": "No se puede eliminar porque esta asociado a un evento"},
                status=400,
            )
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
def event_blocked_hosts(request, event_id):
    """Endpoint para obtener los hosts bloqueados de un evento"""

    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return JsonResponse({"error": "Evento no encontrado"}, status=404)

    if request.method == "GET":
        blocked_hosts = BlockedHost.objects.filter(event=event).select_related(
            "website"
        )
        blocked_website_ids = [str(bh.website.id) for bh in blocked_hosts]

        return JsonResponse({"blocked_website_ids": blocked_website_ids})

    return JsonResponse({"error": "Método no permitido"}, status=405)
