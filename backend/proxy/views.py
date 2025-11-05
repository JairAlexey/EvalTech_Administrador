from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt

from django.db import transaction
from .models import AssignedPort
from events.models import ParticipantEvent
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