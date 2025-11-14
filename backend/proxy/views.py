from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt

from django.db import transaction
from .models import AssignedPort
from events.models import ParticipantEvent
from events.views import validate_event_access  # NUEVO IMPORT
from .server_proxy import DynamicProxyManager
import logging

logger = logging.getLogger(__name__)


def proxy_test(request):
    """Endpoint de test para verificar que las URLs del proxy funcionen"""
    return JsonResponse({"status": "proxy URLs working", "method": request.method})


@csrf_exempt
@require_POST
def release_port(request):
    print(f"[DEBUG] release_port called - Method: {request.method}")
    print(f"[DEBUG] Headers: {dict(request.headers)}")
    print(f"[DEBUG] POST data: {request.POST}")
    print(f"[DEBUG] Body: {request.body}")

    auth_header = request.headers.get("Authorization", "")
    event_key = auth_header.replace("Bearer ", "").strip()
    print(f"[DEBUG] Event key: {event_key}")

    # Get port from POST body
    port = request.POST.get("port")
    if not port:
        return JsonResponse({"error": "Parameter 'port' is required"}, status=400)

    if not event_key or not port:
        return JsonResponse(
            {"error": "Both event_key and port are required"}, status=400
        )

    try:
        with transaction.atomic():
            # Validate participant_event and port
            participant_event = ParticipantEvent.objects.select_related('participant').get(
                event_key=event_key
            )
            
            # Buscar el puerto sin filtrar por is_active
            try:
                assigned_port = AssignedPort.objects.get(
                    port=port,
                    participant_event=participant_event
                )
            except AssignedPort.DoesNotExist:
                return JsonResponse(
                    {"error": "Port not assigned to this user"}, status=404
                )
            
            # Si el puerto ya está inactivo, devolver éxito
            if not assigned_port.is_active:
                print(f"[DEBUG] Port {assigned_port.port} is already inactive")
                return JsonResponse({"status": "Port already released"})

            # Stop the proxy if it is active
            proxy_manager = DynamicProxyManager()
            if int(port) in proxy_manager.active_proxies:
                proxy_instance = proxy_manager.active_proxies[int(port)]
                proxy_instance.stop()
                del proxy_manager.active_proxies[int(port)]

            # End the session (esto actualizará is_active a False y calculará el tiempo)
            print(f"[DEBUG] Deactivating port {assigned_port.port} for participant {participant_event.participant.name}")
            print(f"[DEBUG] Before deactivate - total_duration: {assigned_port.total_duration}, is_active: {assigned_port.is_active}")
            assigned_port.deactivate()
            print(f"[DEBUG] After deactivate - total_duration: {assigned_port.total_duration}, is_active: {assigned_port.is_active}")

            return JsonResponse({"status": "Port successfully released"})

    except ParticipantEvent.DoesNotExist:
        return JsonResponse({"error": "Invalid event key or inactive user"}, status=401)
    except Exception as e:
        logger.error(f"Error in release-port: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)


@csrf_exempt
@require_POST
def start_monitoring(request):
    """Mark participant_event.is_monitoring = True for the event_key in Authorization header"""
    auth_header = request.headers.get("Authorization", "")
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or not parts[1]:
        return JsonResponse({"error": "Invalid format authorization"}, status=401)
    event_key = parts[1]

    from django.utils import timezone
    try:
        pe = ParticipantEvent.objects.get(event_key=event_key)
        
        # Validar que aún se permita el monitoreo
        now = timezone.now()
        access_validation = validate_event_access(pe, now)
        
        if not access_validation["monitoring_allowed"]:
            return JsonResponse({
                "error": "Ya no se permite iniciar monitoreo en este evento"
            }, status=403)
        
        pe.is_monitoring = True
        pe.save(update_fields=["is_monitoring"])
        logger.info(f"start_monitoring called for event_key={event_key}; participant_event id={pe.id}")

        # Actualizar AssignedPort e incrementar contador de sesiones
        try:
            with transaction.atomic():
                ap = AssignedPort.objects.select_for_update().get(participant_event=pe)
                if ap.current_session_time is None:
                    ap.current_session_time = now
                    ap.monitoring_last_change = now
                    # Incrementar contador de sesiones
                    ap.monitoring_sessions_count += 1
                    ap.save(update_fields=[
                        "current_session_time", 
                        "monitoring_last_change", 
                        "monitoring_sessions_count"
                    ])
                    logger.info(f"Started monitoring session #{ap.monitoring_sessions_count} for participant_event {pe.id}")
        except AssignedPort.DoesNotExist:
            logger.info(f"start_monitoring: no AssignedPort found for participant_event id={pe.id}")
            pass

        return JsonResponse({"status": "monitoring_started"})
    except ParticipantEvent.DoesNotExist:
        return JsonResponse({"error": "ParticipantEvent not found"}, status=404)
    except Exception as e:
        logger.error(f"Error in start_monitoring: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@csrf_exempt
@require_POST
def stop_monitoring(request):
    """Mark participant_event.is_monitoring = False for the event_key in Authorization header"""
    auth_header = request.headers.get("Authorization", "")
    parts = auth_header.split(" ", 1)
    if len(parts) != 2 or not parts[1]:
        return JsonResponse({"error": "Invalid format authorization"}, status=401)
    event_key = parts[1]

    from django.utils import timezone
    try:
        pe = ParticipantEvent.objects.get(event_key=event_key)
        pe.is_monitoring = False
        pe.save(update_fields=["is_monitoring"])
        logger.info(f"stop_monitoring called for event_key={event_key}; participant_event id={pe.id}")

        # Si existe AssignedPort asociado, terminar la sesión actual (sin desactivar el puerto)
        # y sumar la duración de forma transaccional para evitar dobles contados.
        try:
            from django.db import transaction
            now = timezone.now()
            with transaction.atomic():
                ap = AssignedPort.objects.select_for_update().get(participant_event=pe)
                if ap.current_session_time:
                    start_time = ap.current_session_time
                    session_seconds = int((now - start_time).total_seconds())
                    if ap.total_duration is None:
                        ap.total_duration = 0
                    ap.total_duration += session_seconds
                    ap.current_session_time = None
                    ap.monitoring_last_change = now
                    ap.save(update_fields=["total_duration", "current_session_time", "monitoring_last_change"])
        except AssignedPort.DoesNotExist:
            logger.info(f"stop_monitoring: no AssignedPort found for participant_event id={pe.id}")
            pass

        return JsonResponse({"status": "monitoring_stopped"})
    except ParticipantEvent.DoesNotExist:
        return JsonResponse({"error": "ParticipantEvent not found"}, status=404)
    except Exception as e:
        logger.error(f"Error in stop_monitoring: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)