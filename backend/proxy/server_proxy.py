import logging
import json
import time
import threading
from urllib.parse import urlparse
from django.core.exceptions import ObjectDoesNotExist
import requests
from administradormonitoreo import settings
from events.models import BlockedHost, ParticipantEvent, Participant

logger = logging.getLogger(__name__)

class DynamicProxyManager:
    """
    Administrador de Proxy 
    
    Responsabilidades:
    - Validar event_keys via HTTP
    - Validar URLs con lógica de bloqueo
    - Enviar logs a API cuando is_monitoring=True
    """
    _instance = None
    
    def __new__(cls):
        if not cls._instance:
            cls._instance = super().__new__(cls)
        return cls._instance

    def _validate_event_key(self, event_key):
        """Valida event_key y retorna participant_event"""
        try:
            participant_event = ParticipantEvent.objects.select_related('participant', 'event').get(
                event_key=event_key
            )
            
            # Verificar que el evento esté activo
            if participant_event.event.status not in ['programado', 'en_progreso']:
                logger.error(f"Event not active for event_key {event_key}: status={participant_event.event.status}")
                return None
                
            return participant_event
        except ObjectDoesNotExist:
            logger.warning(f"Invalid event key: {event_key}")
            return None

    def _send_log_to_api(self, event_key, uri):
        """
        Envía logs a la API para peticiones HTTP.
        Solo envía si participant.is_monitoring=True
        """
        try:
            # Verificar si el participante está en modo monitoreo
            try:
                participant_event = ParticipantEvent.objects.select_related('participant', 'event').get(
                    event_key=event_key
                )
                if not getattr(participant_event, 'is_monitoring', False):
                    logger.debug(f"Skipping log send because participant is not monitoring: {uri}")
                    return
            except ParticipantEvent.DoesNotExist:
                logger.warning(f"ParticipantEvent not found for event_key: {event_key}")
                return
            except Exception as e:
                logger.debug(f"Error checking monitoring state: {e}")
                return

            api_url = f"{settings.BASE_URL}{settings.ADMINISTRADORMONITOREO_API_LOG_HTTP_REQUEST}"
            headers = {
                "Authorization": f"Bearer {event_key}",
                "Content-Type": "application/json"
            }
            data = {"uri": uri}

            # Enviar en un hilo con reintentos
            def _do_send_log(api_url, headers, data):
                import time
                max_attempts = 3
                timeout = 5
                for attempt in range(1, max_attempts + 1):
                    try:
                        resp = requests.post(api_url, headers=headers, json=data, timeout=timeout)
                        if resp.status_code and 200 <= resp.status_code < 300:
                            logger.debug(f"Successfully sent HTTP log (attempt {attempt}): {data.get('uri')}")
                            return True
                        else:
                            logger.warning(f"HTTP log send attempt {attempt} failed: status={resp.status_code}")
                    except Exception as e:
                        logger.warning(f"HTTP log send attempt {attempt} failed: {e}")

                    if attempt < max_attempts:
                        time.sleep(attempt)

                logger.error(f"Failed to send HTTP log after {max_attempts} attempts: {data.get('uri')}")
                return False

            threading.Thread(target=_do_send_log, args=(api_url, headers, data), daemon=True).start()
            
        except Exception as e:
            logger.error(f"Error sending HTTP log: {str(e)}")
            
    def validate_url_http(self, event_key, target_url, method='GET'):
        """
        Valida una URL para peticiones HTTP.
        Retorna si debe ser bloqueada y envía logs automáticamente.
        """
        try:
            # Parsear URL para obtener hostname
            try:
                parsed_url = urlparse(target_url)
                hostname = parsed_url.hostname or parsed_url.netloc
                
                if not hostname:
                    return {
                        'blocked': True,
                        'reason': 'URL inválida'
                    }
            except Exception:
                return {
                    'blocked': True,
                    'reason': 'Error parseando URL'
                }
            
            # Obtener participant_event y hosts bloqueados
            try:
                participant_event = ParticipantEvent.objects.select_related('event').get(event_key=event_key)
                event = participant_event.event
                
                # Obtener hosts bloqueados del evento (solo desde BD)
                blocked_hosts = list(
                    BlockedHost.objects.filter(event=event)
                    .values_list('website__hostname', flat=True)
                )
                
                # Verificar si está bloqueado (solo hosts de la BD)
                is_blocked = any(blocked_host in hostname for blocked_host in blocked_hosts)
                
                if is_blocked:
                    logger.info(f"HTTP URL bloqueada: {hostname} para evento {event.id}")
                    
                    # Enviar log del intento bloqueado
                    try:
                        if getattr(participant_event, 'is_monitoring', False):
                            self._send_log_to_api(event_key, f"⛔ Blocked URL: {target_url}")
                            logger.info(f"⛔ HTTP Blocked URL logged: {target_url}")
                        else:
                            logger.debug(f"HTTP Blocked URL detected but participant not monitoring: {target_url}")
                    except Exception as log_error:
                        logger.warning(f"Error enviando log de bloqueo HTTP: {log_error}")
                    
                    return {
                        'blocked': True,
                        'reason': 'Sitio no permitido durante la evaluación',
                        'hostname': hostname
                    }
                
                # URL permitida - enviar log del acceso
                logger.debug(f"HTTP URL permitida: {hostname} para evento {event.id}")
                
                try:
                    if getattr(participant_event, 'is_monitoring', False):
                        self._send_log_to_api(event_key, target_url)
                        logger.debug(f"📨 HTTP Access logged: {target_url}")
                    else:
                        logger.debug(f"HTTP Access detected but participant not monitoring: {target_url}")
                except Exception as log_error:
                    logger.warning(f"Error enviando log de acceso HTTP: {log_error}")
                
                return {
                    'blocked': False,
                    'allowed': True,
                    'hostname': hostname
                }
                
            except ParticipantEvent.DoesNotExist:
                logger.error(f"ParticipantEvent no encontrado para event_key: {event_key}")
                return {
                    'blocked': True,
                    'reason': 'Evento no encontrado'
                }
                
        except Exception as e:
            logger.error(f"Error en validate_url_http: {str(e)}")
            # En caso de error, bloquear por seguridad
            return {
                'blocked': True,
                'reason': 'Error interno del servidor'
            }

