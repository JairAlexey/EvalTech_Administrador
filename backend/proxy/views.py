from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.db import transaction
from .models import Participant, AssignedPort
from .server_proxy import DynamicProxyManager
import logging

logger = logging.getLogger(__name__)


@require_POST
def release_port(request):

    auth_header = request.headers.get("Authorization", "")
    event_key = auth_header.replace("Bearer ", "").strip()

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
            # Validate participant and port
            participant = Participant.objects.get(event_key=event_key)
            assigned_port = AssignedPort.objects.get(
                port=port, participant=participant, is_active=True
            )

            # Stop the proxy if it is active
            proxy_manager = DynamicProxyManager()
            if int(port) in proxy_manager.active_proxies:
                proxy_instance = proxy_manager.active_proxies[int(port)]
                proxy_instance.stop()
                del proxy_manager.active_proxies[int(port)]

            # Mark port as inactive
            assigned_port.is_active = False
            assigned_port.save()

            # Mark user as inactive
            participant.is_active = False
            participant.save()

            return JsonResponse({"status": "Port successfully released"})

    except Participant.DoesNotExist:
        return JsonResponse({"error": "Invalid event key or inactive user"}, status=401)
    except AssignedPort.DoesNotExist:
        return JsonResponse(
            {"error": "Port not assigned or already released"}, status=404
        )
    except Exception as e:
        logger.error(f"Error in release-port: {str(e)}", exc_info=True)
        return JsonResponse({"error": "Internal server error"}, status=500)
