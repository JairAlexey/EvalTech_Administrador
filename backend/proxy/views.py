from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.db import transaction
from django.core.cache import cache
import json
import time

from events.models import ParticipantEvent
from events.views import validate_event_access
from .server_proxy import DynamicProxyManager
import logging

logger = logging.getLogger(__name__)


def proxy_test(request):
    """Endpoint de test para verificar que las URLs del proxy funcionen"""
    return JsonResponse({"status": "proxy URLs working", "method": request.method})


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
        with transaction.atomic():
            pe = ParticipantEvent.objects.select_for_update().get(event_key=event_key)
            
            # Validar que aún se permita el monitoreo
            now = timezone.now()
            access_validation = validate_event_access(pe, now)
            
            if not access_validation["monitoring_allowed"]:
                return JsonResponse({
                    "error": "Ya no se permite iniciar monitoreo en este evento"
                }, status=403)
            
            # Si ya está monitoreando, devolver éxito sin reiniciar el contador
            if pe.is_monitoring:
                # CORRECCIÓN CRÍTICA: Si el estado es inconsistente (is_monitoring=True pero time=None),
                # debemos iniciar el tiempo AHORA para que esta sesión cuente.
                if pe.monitoring_current_session_time is None:
                    pe.monitoring_current_session_time = now
                    pe.monitoring_last_change = now
                    pe.save(update_fields=["monitoring_current_session_time", "monitoring_last_change"])
                    logger.info(f"Fixed inconsistent state (True/None) for event_key={event_key}")
                
                logger.info(f"start_monitoring called but already active for event_key={event_key}")
                return JsonResponse({"status": "monitoring_already_started"})

            # Actualizar campos de monitoreo en ParticipantEvent
            pe.is_monitoring = True
            
            # SIEMPRE actualizar el tiempo de inicio de sesión al iniciar
            pe.monitoring_current_session_time = now
            pe.monitoring_last_change = now
            pe.monitoring_sessions_count += 1
                
            pe.save(update_fields=[
                "is_monitoring", 
                "monitoring_current_session_time", 
                "monitoring_last_change", 
                "monitoring_sessions_count"
            ])
            
            logger.info(f"start_monitoring called for event_key={event_key}; participant_event id={pe.id}; session #{pe.monitoring_sessions_count}")

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
        with transaction.atomic():
            pe = ParticipantEvent.objects.select_for_update().get(event_key=event_key)
            
            # Calcular duración de la sesión actual y sumarla al total
            now = timezone.now()
            if pe.monitoring_current_session_time:
                start_time = pe.monitoring_current_session_time
                # Asegurar que no restamos si el reloj está mal (aunque usamos server time)
                if now >= start_time:
                    session_seconds = int((now - start_time).total_seconds())
                    pe.monitoring_total_duration += session_seconds
                else:
                    logger.warning(f"Time anomaly detected: now ({now}) < start_time ({start_time})")
                
                pe.monitoring_current_session_time = None
                
            pe.is_monitoring = False
            pe.monitoring_last_change = now
            
            pe.save(update_fields=[
                "is_monitoring", 
                "monitoring_total_duration", 
                "monitoring_current_session_time", 
                "monitoring_last_change"
            ])
            
            logger.info(f"stop_monitoring called for event_key={event_key}; participant_event id={pe.id}; total_duration={pe.monitoring_total_duration}s")

        return JsonResponse({"status": "monitoring_stopped"})
    except ParticipantEvent.DoesNotExist:
        return JsonResponse({"error": "ParticipantEvent not found"}, status=404)
    except Exception as e:
        logger.error(f"Error in stop_monitoring: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)


@csrf_exempt
@require_POST
def proxy_authenticate_http(request):
    """    
    Endpoint HTTP para validar event_key de proxy local.
    Usado por LocalProxyServer para autenticarse con el servidor.
    
    Flujo: LocalProxyServer → POST /api/proxy/auth-http/ → DynamicProxyManager
    - Valida event_key y participant
    - Retorna éxito - el tráfico real va por localhost:8888 (puerto fijo)
    """
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({'error': 'Token de autorización requerido'}, status=401)
        
        event_key = auth_header.replace('Bearer ', '')
        
        # Validar event_key usando DynamicProxyManager
        proxy_manager = DynamicProxyManager()
        participant_event = proxy_manager._validate_event_key(event_key)
        
        if not participant_event:
            logger.warning(f"Token inválido en proxy_authenticate_http: {event_key}")
            return JsonResponse({'error': 'Token inválido'}, status=401)
        
        logger.info(f"Autenticación HTTP exitosa para participante {participant_event.participant.id}")
        
        return JsonResponse({
            'participant_id': participant_event.participant.id,
            'event_id': participant_event.event.id,
            'status': 'authenticated',
            'message': 'Proxy autenticado correctamente - usando puerto fijo 8888'
        })
        
    except Exception as e:
        logger.error(f"Error en proxy_authenticate_http: {str(e)}")
        return JsonResponse({'error': 'Error interno del servidor'}, status=500)


@csrf_exempt
@require_POST
def proxy_validate_url(request):
    """
    Endpoint HTTP para validar URLs desde proxy local.
    Usado por LocalProxyServer para verificar si una URL está permitida.
    
    Flujo: Browser → localhost:8888 → POST /api/proxy/validate/ → validate_url_http()
    - Verifica hosts bloqueados por evento + hosts por defecto
    - Envía logs automáticamente cuando participant.is_monitoring=True  
    - Retorna blocked/allowed para que LocalProxyServer tome acción
    
    SEGURIDAD: Valida que las peticiones vengan del proxy local configurado
    """
    try:
        # VALIDACIÓN ADICIONAL: Verificar header personalizado del proxy local
        proxy_signature = request.headers.get('X-Proxy-Signature', '')
        expected_signature = 'LocalProxyServer-v1'
        
        if proxy_signature != expected_signature:
            logger.warning(f"Petición sin firma de proxy válida desde {request.META.get('REMOTE_ADDR')}")
            # No bloquear por completo, solo advertir (por compatibilidad)
        
        # Validar token
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({'error': 'Token de autorización requerido'}, status=401)
        
        event_key = auth_header.replace('Bearer ', '')
        
        # Validar participante
        proxy_manager = DynamicProxyManager()
        participant = proxy_manager._validate_event_key(event_key)
        
        if not participant:
            logger.warning(f"Token inválido en proxy_validate_url: {event_key}")
            return JsonResponse({'error': 'Token inválido'}, status=401)
        
        # Obtener datos de la petición
        try:
            if hasattr(request, 'data') and request.data:
                data = request.data
            else:
                data = json.loads(request.body.decode('utf-8'))
        except json.JSONDecodeError:
            return JsonResponse({'error': 'JSON inválido'}, status=400)
        
        method = data.get('method', 'GET')
        target_url = data.get('url', '')
        
        if not target_url:
            return JsonResponse({'error': 'URL requerida'}, status=400)
        
        # Usar lógica de validación consolidada del DynamicProxyManager
        result = proxy_manager.validate_url_http(event_key, target_url, method)
        
        return JsonResponse(result)
        
    except Exception as e:
        logger.error(f"Error en proxy_validate_url: {str(e)}")
        # En caso de error, bloquear por seguridad
        return JsonResponse({
            'blocked': True,
            'reason': 'Error interno del servidor'
        })


@csrf_exempt
@require_POST
def proxy_disconnect_http(request):
    """
    Endpoint HTTP para notificar desconexión de proxy local
    Solo valida event_key
    """
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({'error': 'Token de autorización requerido'}, status=401)
        
        event_key = auth_header.replace('Bearer ', '')
        
        # Validar participante
        proxy_manager = DynamicProxyManager()
        participant_event = proxy_manager._validate_event_key(event_key)
        
        if not participant_event:
            return JsonResponse({'error': 'Token inválido'}, status=401)
        
        logger.info(f"Proxy desconectado para participante {participant_event.participant.id}")
        
        return JsonResponse({
            'status': 'disconnected',
            'message': 'Desconexión de proxy registrada correctamente'
        })
            
    except Exception as e:
        logger.error(f"Error en proxy_disconnect_http: {str(e)}")
        return JsonResponse({'error': 'Error interno del servidor'}, status=500)


@csrf_exempt
@require_GET
def proxy_blocklist_version(request):
    """Devuelve la version actual de hosts bloqueados para el event_key."""
    try:
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return JsonResponse({'error': 'Token de autorizacion requerido'}, status=401)

        event_key = auth_header.replace('Bearer ', '')

        proxy_manager = DynamicProxyManager()
        participant_event = proxy_manager._validate_event_key(event_key)

        if not participant_event:
            return JsonResponse({'error': 'Token invalido'}, status=401)

        cache_key = f"proxy_blocklist_version:{participant_event.event.id}"
        version = cache.get(cache_key)
        if version is None:
            version = int(time.time() * 1000)
            cache.set(cache_key, version, None)

        return JsonResponse({'version': version})

    except Exception as e:
        logger.error(f"Error en proxy_blocklist_version: {str(e)}")
        return JsonResponse({'error': 'Error interno del servidor'}, status=500)


