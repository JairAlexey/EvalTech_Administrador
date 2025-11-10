from django.utils import timezone
from datetime import timedelta, datetime
from django.http import JsonResponse, HttpRequest
import json, re
from events.communication import send_emails
from .models import (
    Event,
    Participant,
    ParticipantLog,
    Website,
    BlockedHost,
    ParticipantEvent,
)
from proxy.models import AssignedPort
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
from authentication.models import UserRole
from authentication.views import verify_token, get_user_data
from openpyxl import load_workbook
from openpyxl.workbook import Workbook
from io import BytesIO
from django.http import HttpResponse
from authentication.utils import jwt_required
from django.views.decorators.http import require_POST, require_GET

# Funciones


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
    parts = authorization.split(" ", 1)
    if len(parts) != 2 or not parts[1]:
        return JsonResponse({"error": "Invalid format authorization"}, status=401)

    event_key = parts[1]
    try:
        participant_event = ParticipantEvent.objects.select_related(
            "participant", "event"
        ).get(event_key=event_key)
        participant = participant_event.participant
        event = participant_event.event
        dateIsValid = check_event_time(event)

        # Obtener información del tiempo de conexión
        connection_info = {
            "totalTime": 0,  # Tiempo total acumulado en minutos
            "isActive": False,  # Si está actualmente conectado
            "eventDuration": event.duration,  # Duración total permitida
            # Indica si el participante ha pulsado 'Empezar monitoreo' (permite logs)
            "monitoringAllowed": False,
        }

        try:
            assigned_port = AssignedPort.objects.get(
                participant_event=participant_event
            )
            # Reportar el tiempo real y el puerto, pero usar `is_monitoring`
            # como indicador principal de "Estado" en la UI (si el participante
            # inició realmente el monitoreo). Mantener totalTime desde AssignedPort.
            connection_info["totalTime"] = assigned_port.get_total_time()
            connection_info["isActive"] = bool(getattr(participant_event, "is_monitoring", False))
            connection_info["monitoringAllowed"] = getattr(participant_event, "is_monitoring", False)
        except AssignedPort.DoesNotExist:
            pass

        return JsonResponse(
            {
                "isValid": True,
                "dateIsValid": dateIsValid,
                "participant": {"name": participant.name, "email": participant.email},
                "event": {"name": event.name, "id": event.id},
                "connectionInfo": connection_info,
            }
        )
    except ParticipantEvent.DoesNotExist:
        return JsonResponse({"isValid": False}, status=404)


def get_participant(event_key):
    try:
        participant_event = ParticipantEvent.objects.select_related("participant").get(
            event_key=event_key
        )
        return participant_event.participant
    except ParticipantEvent.DoesNotExist:
        return None


def get_participant_event(event_key):
    """Devuelve el ParticipantEvent asociado al event_key o None si no existe.

    Mantener esta función separada de `get_participant` para no romper código
    que pueda depender todavía en el objeto Participant.
    """
    try:
        participant_event = ParticipantEvent.objects.select_related(
            "participant", "event"
        ).get(event_key=event_key)
        return participant_event
    except ParticipantEvent.DoesNotExist:
        return None


def _validate_participant_fields(
    first_name: str, last_name: str, email: str, seen_emails: set
):
    errors = []
    fn = (first_name or "").strip()
    ln = (last_name or "").strip()
    em = (email or "").strip().lower()

    if not fn:
        errors.append("Nombre requerido")
    if not ln:
        errors.append("Apellidos requeridos")
    if not em:
        errors.append("Email requerido")
    else:
        try:
            validate_email(em)
        except ValidationError:
            errors.append("Email inválido")

    # Duplicado dentro del archivo (o del payload)
    if em:
        if em in seen_emails:
            errors.append("Email duplicado en el archivo")
        else:
            seen_emails.add(em)

    # Duplicado en BD
    if em and Participant.objects.filter(email__iexact=em).exists():
        errors.append("Email ya existe en el sistema")

    return fn, ln, em, errors


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
        for participant in participants_to_add:
            ParticipantEvent.objects.get_or_create(event=event, participant=participant)

        # Quitar asociaciones eliminando el registro intermedio
        for email in emails_to_remove:
            participant = current_by_email.get(email)
            if participant:
                ParticipantEvent.objects.filter(
                    event=event, participant=participant
                ).delete()

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


# Endpoints app escritorio


@require_POST
def log_participant_http_event(request: HttpRequest):

    try:
        data = json.loads(request.body)
        auth = request.headers.get("Authorization", "")
        parts = auth.split(" ", 1)
        if len(parts) != 2 or not parts[1]:
            return JsonResponse({"error": "Invalid format authorization"}, status=401)
        event_key = parts[1]
        participant_event = get_participant_event(event_key)
        if not participant_event:
            return JsonResponse({"error": "ParticipantEvent not found"}, status=404)

        if not getattr(participant_event, "is_monitoring", False):
            return JsonResponse({"error": "Monitoring not started"}, status=403)

        ParticipantLog.objects.create(
            name="http", message=data["uri"], participant_event=participant_event
        )
        return JsonResponse({"status": "success"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@require_POST
def log_participant_keylogger_event(request: HttpRequest):

    try:
        data = json.loads(request.body)
        auth = request.headers.get("Authorization", "")
        parts = auth.split(" ", 1)
        if len(parts) != 2 or not parts[1]:
            return JsonResponse({"error": "Invalid format authorization"}, status=401)
        event_key = parts[1]
        participant_event = get_participant_event(event_key)
        if not participant_event:
            return JsonResponse({"error": "ParticipantEvent not found"}, status=404)

        if not getattr(participant_event, "is_monitoring", False):
            return JsonResponse({"error": "Monitoring not started"}, status=403)

        ParticipantLog.objects.create(
            name="keylogger", message="\n".join(data["keys"]), participant_event=participant_event
        )
        return JsonResponse({"status": "success"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@require_POST
def log_participant_screen_event(request: HttpRequest):

    try:
        auth = request.headers.get("Authorization", "")
        parts = auth.split(" ", 1)
        if len(parts) != 2 or not parts[1]:
            return JsonResponse({"error": "Invalid format authorization"}, status=401)
        event_key = parts[1]
        participant_event = get_participant_event(event_key)
        if not participant_event:
            return JsonResponse({"error": "ParticipantEvent not found"}, status=404)

        if not getattr(participant_event, "is_monitoring", False):
            return JsonResponse({"error": "Monitoring not started"}, status=403)

        file = request.FILES["screenshot"]
        ParticipantLog.objects.create(
            name="screen",
            file=file,
            message="Desktop Screenshot",
            participant_event=participant_event,
        )
        return JsonResponse({"status": "success"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@require_POST
def log_participant_audio_video_event(request: HttpRequest):

    try:
        auth = request.headers.get("Authorization", "")
        parts = auth.split(" ", 1)
        if len(parts) != 2 or not parts[1]:
            return JsonResponse({"error": "Invalid format authorization"}, status=401)
        event_key = parts[1]
        participant_event = get_participant_event(event_key)
        if not participant_event:
            return JsonResponse({"error": "ParticipantEvent not found"}, status=404)

        if not getattr(participant_event, "is_monitoring", False):
            return JsonResponse({"error": "Monitoring not started"}, status=403)

        file = request.FILES["media"]
        ParticipantLog.objects.create(
            name="audio/video",
            file=file,
            message="Media Capture",
            participant_event=participant_event,
        )
        return JsonResponse({"status": "success"})

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


# Endpoints app web


@csrf_exempt
@jwt_required()
@require_POST
def send_key_emails(request, event_id):
    try:
        # Obtener participantIds del body
        try:
            data = json.loads(request.body.decode("utf-8"))
            participant_ids = data.get("participantIds", [])
        except Exception:
            participant_ids = []

        user = request.user
        try:
            user_role = UserRole.objects.get(user=user)
        except UserRole.DoesNotExist:
            return JsonResponse({"error": "Usuario no encontrado"}, status=404)

        # Verificar que el evento existe
        try:
            event = Event.objects.get(id=event_id)
        except Event.DoesNotExist:
            return JsonResponse({"error": "Evento no encontrado"}, status=404)

        # Permitir solo si es evaluador del evento, admin o superadmin
        if str(event.evaluator_id) != str(user.id) and user_role.role not in [
            "superadmin",
            "admin",
        ]:
            return JsonResponse(
                {
                    "error": "Solo el evaluador asignado o administrador puede enviar correos"
                },
                status=403,
            )

        # Llamar a la función de envío de correos
        result = send_emails(event_id, participant_ids if participant_ids else None)

        if result["success"]:
            return JsonResponse({"success": True, "sent": result["sent"]})
        else:
            return JsonResponse({"error": result["error"]}, status=400)

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=400)


@csrf_exempt
@jwt_required()
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
@jwt_required()
@require_GET
def participants_template(request):
    """Devuelve una plantilla Excel con columnas requeridas: Nombre, Apellidos, Email"""

    wb = Workbook()
    ws = wb.active
    ws.title = "Participantes"
    ws.append(["Nombre", "Apellidos", "Email"])
    # Fila ejemplo vacía (opcional)
    ws.append(["", "", ""])

    bio = BytesIO()
    wb.save(bio)
    bio.seek(0)

    response = HttpResponse(
        bio.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )
    response["Content-Disposition"] = (
        'attachment; filename="plantilla_participantes.xlsx"'
    )
    return response


@csrf_exempt
@jwt_required()
@require_POST
def import_participants(request):
    """Importa participantes desde Excel (modo previsualización o creación) .

    - POST multipart/form-data con campo 'file': parsea Excel y devuelve filas validadas (no crea si dry_run=1).
    - POST application/json con 'rows': valida y crea participantes, devolviendo resumen.
    """

    # Determinar dry_run
    dry_raw = request.GET.get("dry_run") or request.POST.get("dry_run")
    dry_run = str(dry_raw).lower() in {"1", "true", "yes"}

    results = []

    # Modo archivo Excel (previsualización)
    if "file" in request.FILES:
        up_file = request.FILES["file"]

        # Validar tipo de archivo por extensión y content_type
        filename = getattr(up_file, "name", "")
        content_type = getattr(up_file, "content_type", "")
        if not (
            filename.lower().endswith(".xlsx")
            or content_type
            == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ):
            return JsonResponse(
                {"error": "El archivo debe ser un Excel (.xlsx)"}, status=400
            )

        try:
            wb = load_workbook(up_file, data_only=True)
            ws = wb.active
        except Exception as e:
            return JsonResponse(
                {"error": f"No se pudo leer el Excel: {str(e)}"}, status=400
            )

        # Leer cabeceras
        headers = []
        for cell in ws[1]:
            value = (
                (cell.value or "").strip()
                if isinstance(cell.value, str)
                else (cell.value or "")
            )
            headers.append(str(value))

        normalized = [h.strip().lower() for h in headers]
        expected = ["nombre", "apellidos", "email"]
        if normalized[:3] != expected:
            return JsonResponse(
                {
                    "error": "Formato inválido. Las primeras 3 columnas deben ser: Nombre, Apellidos, Email",
                    "headers": headers,
                },
                status=400,
            )

        col_idx = {"nombre": 1, "apellidos": 2, "email": 3}

        seen_emails = set()
        for row_idx in range(2, ws.max_row + 1):
            fn = ws.cell(row=row_idx, column=col_idx["nombre"]).value
            ln = ws.cell(row=row_idx, column=col_idx["apellidos"]).value
            em = ws.cell(row=row_idx, column=col_idx["email"]).value

            fn, ln, em, errs = _validate_participant_fields(fn, ln, em, seen_emails)
            results.append(
                {
                    "row_number": row_idx,
                    "first_name": fn,
                    "last_name": ln,
                    "email": em,
                    "errors": errs,
                }
            )

        # En modo archivo siempre devolvemos previsualización (no creamos), a menos que dry_run sea falso explícitamente.
        if dry_run or True:
            valid_count = sum(1 for r in results if not r["errors"])
            invalid_count = len(results) - valid_count
            return JsonResponse(
                {
                    "rows": results,
                    "valid_count": valid_count,
                    "invalid_count": invalid_count,
                }
            )

    # Modo JSON
    try:
        data = json.loads(request.body or b"{}")
    except Exception:
        data = {}

    rows = data.get("rows", [])
    if not isinstance(rows, list) or not rows:
        return JsonResponse(
            {"error": "Se requiere un arreglo 'rows' para importar"}, status=400
        )

    created = 0
    output_rows = []
    seen_emails = set()

    for idx, r in enumerate(rows, start=1):
        fn, ln, em = r.get("first_name"), r.get("last_name"), r.get("email")
        fn, ln, em, errs = _validate_participant_fields(fn, ln, em, seen_emails)
        if errs:
            output_rows.append(
                {
                    "index": idx,
                    "first_name": fn,
                    "last_name": ln,
                    "email": em,
                    "errors": errs,
                }
            )
            continue

        try:
            Participant.objects.create(
                first_name=fn, last_name=ln, name=f"{fn} {ln}".strip(), email=em
            )
            created += 1
            output_rows.append(
                {
                    "index": idx,
                    "first_name": fn,
                    "last_name": ln,
                    "email": em,
                    "errors": [],
                }
            )
        except Exception as e:
            output_rows.append(
                {
                    "index": idx,
                    "first_name": fn,
                    "last_name": ln,
                    "email": em,
                    "errors": [str(e)],
                }
            )

    return JsonResponse(
        {
            "created": created,
            "failed": len(output_rows) - created,
            "rows": output_rows,
        }
    )


@csrf_exempt
@jwt_required(roles=["admin", "superadmin"])
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
            email_changed = False

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
                email_changed = True

            if changed:
                participant.save()
                # Si el correo cambió, actualiza los event_key de los eventos asociados
                if email_changed:
                    for pe in ParticipantEvent.objects.filter(participant=participant):
                        pe.generate_event_key()
                        pe.save()

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
            return JsonResponse(
                {
                    "error": "No se pudo eliminar el participante porque está asociado a uno o más eventos."
                },
                status=400,
            )

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@jwt_required()
def events(request):

    user = request.user
    try:
        user_role = UserRole.objects.get(user=user).role
    except UserRole.DoesNotExist:
        user_role = None

    if request.method == "GET":

        # Filtrar eventos según rol: admin/superadmin -> todos, evaluator -> solo sus eventos
        if user_role in ("admin", "superadmin"):
            events = Event.objects.all().order_by("start_date")
        elif user_role == "evaluator":
            events = Event.objects.filter(evaluator__id=user.id).order_by("start_date")
        else:
            # Comportamiento por defecto (sin token o rol desconocido): listar todos
            events = Event.objects.all().order_by("start_date")

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
            # Duración en minutos
            duration_minutes = event.duration if event.duration else 0
            # Fecha de fin
            end_date_str = event.end_date.strftime("%d/%m/%Y") if event.end_date else ""
            end_time_str = event.end_date.strftime("%H:%M %p") if event.end_date else ""

            # Mapear estado interno a formato de presentación
            status_mapping = {
                "programado": "Programado",
                "en_progreso": "En progreso",
                "completado": "Completado",
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
                    "duration": duration_minutes,
                    "endDate": end_date_str,
                    "endTime": end_time_str,
                    "participants": participant_count,
                    "status": display_status,
                    "evaluator": evaluator_data,
                }
            )

        return JsonResponse({"events": events_data})

    elif request.method == "POST":

        # Solo admin/superadmin pueden crear eventos
        if user_role not in ("admin", "superadmin"):
            return JsonResponse(
                {"error": "No tienes permisos para crear eventos"},
                status=403,
            )

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
                "duration": "duración",
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

            # =======================
            # Validar duración
            # =======================
            duration_minutes = data.get("duration")
            try:
                duration_minutes = int(duration_minutes)
                if duration_minutes < 15:
                    return JsonResponse(
                        {"error": "La duración debe ser de al menos 15 minutos"},
                        status=400,
                    )
                if duration_minutes > 300:  # 5 horas
                    return JsonResponse(
                        {"error": "La duración no puede exceder 5 horas"},
                        status=400,
                    )
            except (ValueError, TypeError):
                return JsonResponse(
                    {"error": "La duración debe ser un número válido de minutos"},
                    status=400,
                )

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
            max_close_local = start_local + timedelta(minutes=30)
            if close_local < min_close_local:
                return JsonResponse(
                    {
                        "error": "La hora de cierre debe ser al menos 5 minutos después de la hora de inicio"
                    },
                    status=400,
                )
            if close_local > max_close_local:
                return JsonResponse(
                    {
                        "error": "La hora de cierre no puede ser más de 30 minutos después de la hora de inicio"
                    },
                    status=400,
                )

            # Convertir a UTC para guardar en la BD
            start_utc = start_local.astimezone(ZoneInfo("UTC"))
            close_utc = close_local.astimezone(ZoneInfo("UTC"))

            # Calcular end_date (closeTime + duración en minutos)
            end_utc = close_utc + timedelta(minutes=duration_minutes)

            # =======================
            # 2) Participantes
            # =======================
            participants = data.get("participants", [])
            selected_participants = [
                c for c in participants if c.get("selected", False)
            ]

            # Validar que los participantes no tengan eventos solapados
            conflicting_participants = []
            for participant_data in selected_participants:
                cid = participant_data.get("id")
                if cid:
                    try:
                        participant = Participant.objects.get(id=cid)
                        # Buscar eventos donde el participante esté asignado y se solapen
                        overlapping = Event.objects.filter(
                            participants=participant,
                            start_date__lt=end_utc,
                            end_date__gt=start_utc,
                        )
                        if overlapping.exists():
                            conflicting_participants.append(participant.name)
                    except Participant.DoesNotExist:
                        pass

            if conflicting_participants:
                return JsonResponse(
                    {
                        "error": f"Los siguientes participantes ya tienen eventos en ese rango de fechas: {', '.join(conflicting_participants)}"
                    },
                    status=400,
                )

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

            # Validar que el evaluador no tenga eventos solapados (por rango de fechas)
            overlapping_events = Event.objects.filter(
                evaluator=evaluator_instance,
                start_date__lt=end_utc,
                end_date__gt=start_utc,
            )
            if overlapping_events.exists():
                return JsonResponse(
                    {
                        "error": "El evaluador ya tiene otro evento en ese rango de fechas"
                    },
                    status=400,
                )

            new_event = Event.objects.create(
                name=data.get("eventName", ""),
                description=data.get("description", ""),
                start_date=start_utc,
                close_date=close_utc,
                duration=duration_minutes,
                end_date=end_utc,
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
                        ParticipantEvent.objects.get_or_create(
                            event=new_event, participant=participant
                        )
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
@jwt_required()
def event_detail(request, event_id):

    user = request.user
    try:
        user_role = UserRole.objects.get(user=user).role
    except UserRole.DoesNotExist:
        user_role = None

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

        # Formatear hora para el frontend
        close_time_str = (
            event.close_date.strftime("%H:%M")
            if getattr(event, "close_date", None)
            else ""
        )
        end_date_str = event.end_date.strftime("%d/%m/%Y") if event.end_date else ""
        end_time_str = event.end_date.strftime("%H:%M") if event.end_date else ""

        # Serializar el evaluador como string + id
        evaluator_name = None
        evaluator_id = None
        if event.evaluator:
            evaluator_name = f"{event.evaluator.first_name} {event.evaluator.last_name}"
            evaluator_id = str(event.evaluator.id)

        # Calcular duración en minutos
        duration_minutes = event.duration

        # Obtener páginas bloqueadas (hostnames)
        blocked_hosts = BlockedHost.objects.filter(event=event).select_related(
            "website"
        )
        blocked_websites = [bh.website.hostname for bh in blocked_hosts]

        event_data = {
            "id": event.id,
            "name": event.name,
            "description": event.description,
            "startDate": (
                event.start_date.strftime("%Y-%m-%d") if event.start_date else ""
            ),
            "startTime": (
                event.start_date.strftime("%H:%M") if event.start_date else ""
            ),
            "closeTime": close_time_str,
            "duration": duration_minutes,
            "evaluator": evaluator_name,
            "evaluatorId": evaluator_id,
            "status": event.status,
            "participants": participants_data,
            "endDate": end_date_str,
            "endTime": end_time_str,
            "blockedWebsites": blocked_websites,
        }

        return JsonResponse({"event": event_data})

    elif request.method == "PUT":
        try:
            data = json.loads(request.body)

            # ========================================
            # VALIDACIÓN DE ESTADO DEL EVENTO
            # ========================================

            # Si el evento está completado, no se puede editar nada
            if event.status == "completado":
                return JsonResponse(
                    {"error": "No se puede editar un evento que ya ha sido completado"},
                    status=400,
                )

            # Si el evento está en progreso, validar que no se cambien fecha/hora de inicio
            if event.status == "en_progreso":
                incoming_start_date = data.get("startDate", "").strip()
                incoming_start_time = data.get("startTime", "").strip()

                # Parsear fecha/hora de inicio entrante
                try:
                    incoming_start_naive = datetime.strptime(
                        f"{incoming_start_date} {incoming_start_time}", "%Y-%m-%d %H:%M"
                    )
                except ValueError:
                    try:
                        incoming_start_naive = datetime.strptime(
                            f"{incoming_start_date} {incoming_start_time}",
                            "%d/%m/%Y %H:%M",
                        )
                    except ValueError:
                        return JsonResponse(
                            {"error": "Formato de fecha/hora de inicio inválido"},
                            status=400,
                        )

                # Obtener timezone del usuario
                tz_str = (data.get("timezone") or "").strip() or "America/Guayaquil"
                try:
                    user_tz = ZoneInfo(tz_str)
                except Exception:
                    user_tz = ZoneInfo("America/Guayaquil")

                incoming_start_local = timezone.make_aware(
                    incoming_start_naive, user_tz
                )
                incoming_start_utc = incoming_start_local.astimezone(ZoneInfo("UTC"))

                # Comparar con la fecha/hora de inicio actual (sin tolerancia)
                if event.start_date != incoming_start_utc:
                    return JsonResponse(
                        {
                            "error": "No se puede modificar la fecha u hora de inicio de un evento en progreso"
                        },
                        status=400,
                    )

            # ========================================
            # VALIDACIONES GENERALES (continúan igual)
            # ========================================

            # Validaciones requeridas
            field_names = {
                "eventName": "nombre del evento",
                "description": "descripción",
                "startDate": "fecha de inicio",
                "startTime": "hora de inicio",
                "closeTime": "hora de cierre",
                "evaluator": "evaluador",
                "duration": "duración",
            }
            # Si es un evaluador, no exigir el campo "evaluator" en el payload
            if user_role == "evaluator":
                field_names.pop("evaluator", None)

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
            if (
                Event.objects.filter(name__iexact=event_name)
                .exclude(id=event.id)
                .exists()
            ):
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

            # =======================
            # Validar duración
            # =======================
            duration_minutes = data.get("duration")
            try:
                duration_minutes = int(duration_minutes)
                if duration_minutes < 15:
                    return JsonResponse(
                        {"error": "La duración debe ser de al menos 15 minutos"},
                        status=400,
                    )
                if duration_minutes > 300:  # 5 horas
                    return JsonResponse(
                        {"error": "La duración no puede exceder 5 horas"},
                        status=400,
                    )
            except (ValueError, TypeError):
                return JsonResponse(
                    {"error": "La duración debe ser un número válido de minutos"},
                    status=400,
                )

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

            # Validar que la fecha/hora de inicio sea posterior a ahora
            # OMITIR esta validación si el evento está en progreso (no se permite cambiar inicio, pero sí otros campos)
            if event.status != "en_progreso":
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
            max_close_local = start_local + timedelta(minutes=30)
            if close_local < min_close_local:
                return JsonResponse(
                    {
                        "error": "La hora de cierre debe ser al menos 5 minutos después de la hora de inicio"
                    },
                    status=400,
                )
            if close_local > max_close_local:
                return JsonResponse(
                    {
                        "error": "La hora de cierre no puede ser más de 30 minutos después de la hora de inicio"
                    },
                    status=400,
                )

            # Convertir a UTC para guardar en la BD
            start_utc = start_local.astimezone(ZoneInfo("UTC"))
            close_utc = close_local.astimezone(ZoneInfo("UTC"))
            end_utc = close_utc + timedelta(minutes=duration_minutes)

            # Evaluador
            evaluator_id = data.get("evaluator", "")
            if user_role == "evaluator":
                # Un evaluador no puede cambiar el evaluador asignado
                if evaluator_id and str(evaluator_id) != str(event.evaluator_id):
                    return JsonResponse(
                        {
                            "error": "No tienes permiso para cambiar el evaluador del evento"
                        },
                        status=403,
                    )
                evaluator_instance = event.evaluator
            else:
                try:
                    evaluator_instance = CustomUser.objects.get(id=evaluator_id)
                except CustomUser.DoesNotExist:
                    return JsonResponse(
                        {"error": "El evaluador seleccionado no existe"}, status=400
                    )

            # Validar que el evaluador no tenga eventos solapados (excluyendo el actual)
            overlapping_events = Event.objects.filter(
                evaluator=evaluator_instance,
                start_date__lt=end_utc,
                end_date__gt=start_utc,
            ).exclude(id=event.id)
            if overlapping_events.exists():
                return JsonResponse(
                    {
                        "error": "El evaluador ya tiene otro evento en ese rango de fechas"
                    },
                    status=400,
                )

            # Validar que los participantes no tengan eventos solapados (excluyendo el evento actual)
            participants = data.get("participants", [])
            selected_participants = [
                c for c in participants if c.get("selected", False)
            ]

            conflicting_participants = []
            for participant_data in selected_participants:
                cid = participant_data.get("id")
                if cid:
                    try:
                        participant = Participant.objects.get(id=cid)
                        overlapping = Event.objects.filter(
                            participants=participant,
                            start_date__lt=end_utc,
                            end_date__gt=start_utc,
                        ).exclude(id=event.id)
                        if overlapping.exists():
                            conflicting_participants.append(participant.name)
                    except Participant.DoesNotExist:
                        pass

            if conflicting_participants:
                return JsonResponse(
                    {
                        "error": f"Los siguientes participantes ya tienen eventos en ese rango de fechas: {', '.join(conflicting_participants)}"
                    },
                    status=400,
                )

            # Actualización de campos
            changed = False
            if event.name != event_name:
                event.name = event_name
                changed = True
            if event.description != description:
                event.description = description
                changed = True
            if event.start_date != start_utc:
                event.start_date = start_utc
                changed = True
            if getattr(event, "close_date", None) != close_utc:
                event.close_date = close_utc
                changed = True
            # El evaluador solo puede ser cambiado por admin/superadmin
            if event.evaluator != evaluator_instance:
                event.evaluator = evaluator_instance
                changed = True
            if event.duration != duration_minutes:
                event.duration = duration_minutes
                changed = True
            if event.end_date != end_utc:
                event.end_date = end_utc
                changed = True

            if changed:
                event.save()

            # Participantes
            if "participants" in data:
                try:
                    handle_event_participants(event, data.get("participants", []))
                except Exception as participant_error:
                    print(f"Error processing participantes: {participant_error}")

            # Websites bloqueados
            if "blockedWebsites" in data:
                incoming_ids = set()
                for wid in data.get("blockedWebsites") or []:
                    try:
                        incoming_ids.add(int(wid))
                    except (TypeError, ValueError):
                        continue

                existing_bh = BlockedHost.objects.filter(event=event)
                existing_ids = set(existing_bh.values_list("website_id", flat=True))

                to_add = incoming_ids - existing_ids
                to_remove = existing_ids - incoming_ids

                if to_add:
                    for wid in to_add:
                        try:
                            website = Website.objects.get(id=wid)
                            BlockedHost.objects.get_or_create(
                                event=event, website=website
                            )
                        except Website.DoesNotExist:
                            continue

                if to_remove:
                    BlockedHost.objects.filter(
                        event=event, website_id__in=list(to_remove)
                    ).delete()

            return JsonResponse({"success": True, "updated": changed})

        except Exception as e:
            print(f"Error updating event: {e}")
            return JsonResponse({"error": str(e)}, status=400)

    elif request.method == "DELETE":

        # Solo admin/superadmin pueden eliminar eventos
        if user_role not in ("admin", "superadmin"):
            return JsonResponse(
                {"error": "No tienes permisos para eliminar eventos"},
                status=403,
            )

        # No permitir eliminar si el evento está en progreso
        if event.status == "en_progreso":
            return JsonResponse(
                {"error": "No se puede eliminar un evento que está en progreso"},
                status=400,
            )

        # Eliminar un evento
        try:
            event.delete()
            return JsonResponse({"success": True})
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=400)

    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@jwt_required()
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
@jwt_required()
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
@jwt_required()
@require_GET
def event_blocked_hosts(request, event_id):
    """Endpoint para obtener los hosts bloqueados de un evento"""

    try:
        event = Event.objects.get(id=event_id)
    except Event.DoesNotExist:
        return JsonResponse({"error": "Evento no encontrado"}, status=404)

    blocked_hosts = BlockedHost.objects.filter(event=event).select_related("website")
    blocked_website_ids = [str(bh.website.id) for bh in blocked_hosts]

    return JsonResponse({"blocked_website_ids": blocked_website_ids})


@csrf_exempt
@jwt_required()
@require_GET
def evaluaciones(request):
    """
    Endpoint para listar evaluaciones (eventos en progreso y completados).
    Admin/superadmin ven todas, evaluadores solo las suyas.
    """
    user = request.user
    try:
        user_role = UserRole.objects.get(user=user).role
    except UserRole.DoesNotExist:
        user_role = None

    # Filtrar eventos por estado
    estados = ["en_progreso", "completado"]
    if user_role in ("admin", "superadmin"):
        eventos = Event.objects.filter(status__in=estados).order_by("start_date")
    elif user_role == "evaluator":
        eventos = Event.objects.filter(
            status__in=estados, evaluator__id=user.id
        ).order_by("start_date")
    else:
        eventos = Event.objects.filter(status__in=estados).order_by("start_date")

    eventos_data = []
    for evento in eventos:
        participant_count = Participant.objects.filter(events=evento).count()
        eventos_data.append(
            {
                "id": evento.id,
                "name": evento.name,
                "startDate": (
                    evento.start_date.strftime("%d/%m/%Y") if evento.start_date else ""
                ),
                "startTime": (
                    evento.start_date.strftime("%H:%M %p") if evento.start_date else ""
                ),
                "duration": evento.duration,
                "endDate": (
                    evento.end_date.strftime("%d/%m/%Y") if evento.end_date else ""
                ),
                "endTime": (
                    evento.end_date.strftime("%H:%M %p") if evento.end_date else ""
                ),
                "participants": participant_count,
                "status": evento.status,
            }
        )

    return JsonResponse({"evaluaciones": eventos_data})


@csrf_exempt
@jwt_required()
@require_GET
def evaluation_detail(request, evaluation_id):
    """
    Endpoint para obtener el detalle de una evaluación (evento).
    Devuelve los datos en el formato de EvaluationDetail.
    """
    try:
        event = Event.objects.get(id=evaluation_id)
    except Event.DoesNotExist:
        return JsonResponse({"error": "Evaluación no encontrada"}, status=404)

    participants = Participant.objects.filter(events=event)
    participants_data = [
        {
            "id": str(p.id),
            "name": p.name,
            "initials": p.get_initials() if hasattr(p, "get_initials") else "",
            "status": "activo",  # Puedes ajustar el status según tu lógica
            "color": f"bg-{['blue', 'green', 'purple', 'red', 'yellow', 'indigo', 'pink'][p.id % 7]}-200",
        }
        for p in participants
    ]

    evaluator_name = None
    if event.evaluator:
        evaluator_name = f"{event.evaluator.first_name} {event.evaluator.last_name}"

    detail = {
        "id": str(event.id),
        "name": event.name,
        "description": event.description,
        "startDate": event.start_date.strftime("%Y-%m-%d") if event.start_date else "",
        "startTime": event.start_date.strftime("%H:%M") if event.start_date else "",
        "duration": event.duration,
        "endDate": event.end_date.strftime("%Y-%m-%d") if event.end_date else "",
        "endTime": event.end_date.strftime("%H:%M") if event.end_date else "",
        "status": event.status,
        "participants": participants_data,
        "evaluator": evaluator_name,
    }

    return JsonResponse({"event": detail})


# Logs


@csrf_exempt
@require_GET
def event_participant_logs(request, event_id, participant_id):
    """Endpoint para obtener todos los logs de un participante específico de un evento"""
    try:
        event = Event.objects.get(id=event_id)
        participant = Participant.objects.get(id=participant_id)
        
        # Obtener el ParticipantEvent específico
        participant_event = ParticipantEvent.objects.filter(
            event=event,
            participant=participant
        ).first()
        
        if not participant_event:
            return JsonResponse(
                {"error": "Participant not found in this event"}, 
                status=404
            )

        # Filtrar logs solo del participante específico
        logs = ParticipantLog.objects.filter(participant_event=participant_event)

        logs_data = []
        for log in logs:
            # Si el modelo ParticipantLog tuviera un campo created_at lo usamos,
            # si no existe (compatibilidad) usamos el id como fallback para
            # mantener un valor entero ordenable usado por el frontend.
            created_ts = None
            if hasattr(log, "created_at") and getattr(log, "created_at"):
                try:
                    created_ts = int(log.created_at.timestamp())
                except Exception:
                    created_ts = None
            if created_ts is None:
                created_ts = int(log.id)

            log_data = {
                "id": log.id,
                "name": log.name,
                "message": log.message,
                "created_at": created_ts,
                "has_file": bool(log.file),
                "file_url": log.file.url if log.file else None,
            }
            logs_data.append(log_data)

        return JsonResponse(
            {
                "event": {"id": event.id, "name": event.name},
                "logs": logs_data,
                "total": len(logs_data),
            }
        )

    except Event.DoesNotExist:
        return JsonResponse({"error": "Event not found"}, status=404)
    except Participant.DoesNotExist:
        return JsonResponse({"error": "Participant not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def participant_connection_stats(request, participant_id):
    """Endpoint para obtener estadísticas de conexión de un participante"""
    if request.method != "GET":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    try:
        from proxy.models import AssignedPort

        participant = Participant.objects.get(id=participant_id)

        # Buscar el ParticipantEvent activo del participante
        participant_event = ParticipantEvent.objects.filter(
            participant=participant
        ).first()

        connection_data = {
            "participant": {
                "id": participant.id,
                "name": participant.name,
                "email": participant.email,
            },
            "total_time_minutes": 0,
            "is_active": False,
            "last_activity": None,
            "port": None,
        }

        if participant_event:
            try:
                assigned_port = AssignedPort.objects.get(
                    participant_event=participant_event
                )
                # Solo reportar tiempo/activo si el participante ya pulsó "Empezar monitoreo"
                # Reportar siempre los valores reales del AssignedPort (tiempo total y estado),
                # pero proveer un flag `monitoringAllowed` para indicar si el participante
                # pulsó "Empezar monitoreo" y por tanto si se permiten envíos de logs.
                connection_data.update(
                    {
                        "total_time_minutes": assigned_port.get_total_time(),
                        "is_active": bool(getattr(participant_event, "is_monitoring", False)),
                        "last_activity": assigned_port.last_activity,
                        "port": assigned_port.port,
                        "monitoringAllowed": getattr(participant_event, "is_monitoring", False),
                    }
                )
            except AssignedPort.DoesNotExist:
                pass

        return JsonResponse(connection_data)

    except Participant.DoesNotExist:
        return JsonResponse({"error": "Participant not found"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
