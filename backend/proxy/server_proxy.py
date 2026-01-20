import logging
import threading
import time
from urllib.parse import urlparse

import requests
from django.core.exceptions import ObjectDoesNotExist

from administradormonitoreo import settings
from events.models import BlockedHost, ParticipantEvent

logger = logging.getLogger(__name__)


class DynamicProxyManager:
    """
    Administrador de Proxy

    Responsabilidades:
    - Validar event_keys via HTTP
    - Validar URLs con logica de bloqueo
    - Enviar logs a API cuando is_monitoring=True
    """

    _instance = None

    def __new__(cls):
        if not cls._instance:
            cls._instance = super().__new__(cls)
            # Cache en memoria para evitar logs duplicados en ventanas cortas
            cls._instance._recent_block_logs = {}
            cls._instance._recent_block_logs_lock = threading.Lock()
        return cls._instance

    def _should_log_block(self, cache_key, cooldown_seconds=2, ttl_seconds=30):
        """
        Evita enviar multiples logs de la misma URL en ventanas cortas.
        cache_key: tupla (event_key, hostname)
        cooldown_seconds: intervalo minimo entre logs iguales
        ttl_seconds: tiempo de vida para purgar entradas viejas
        """
        now = time.monotonic()
        with self._recent_block_logs_lock:
            last_logged = self._recent_block_logs.get(cache_key)
            if last_logged and (now - last_logged) < cooldown_seconds:
                return False

            self._recent_block_logs[cache_key] = now

            cutoff = now - ttl_seconds
            stale_keys = [k for k, ts in self._recent_block_logs.items() if ts < cutoff]
            for key in stale_keys:
                self._recent_block_logs.pop(key, None)

            return True

    def _validate_event_key(self, event_key):
        """Valida event_key y retorna participant_event"""
        try:
            participant_event = ParticipantEvent.objects.select_related("participant", "event").get(
                event_key=event_key
            )

            # Verificar que el evento este activo
            if participant_event.event.status not in ["programado", "en_progreso"]:
                logger.error(
                    f"Event not active for event_key {event_key}: status={participant_event.event.status}"
                )
                return None

            return participant_event
        except ObjectDoesNotExist:
            logger.warning(f"Invalid event key: {event_key}")
            return None

    def _send_log_to_api(self, event_key, uri):
        """
        Envia logs a la API para peticiones HTTP.
        Solo envia si participant.is_monitoring=True
        """
        try:
            # Verificar si el participante esta en modo monitoreo
            try:
                participant_event = ParticipantEvent.objects.select_related("participant", "event").get(
                    event_key=event_key
                )
                if not getattr(participant_event, "is_monitoring", False):
                    logger.debug(f"Skipping log send because participant is not monitoring: {uri}")
                    return
            except ParticipantEvent.DoesNotExist:
                logger.warning(f"ParticipantEvent not found for event_key: {event_key}")
                return
            except Exception as exc:
                logger.debug(f"Error checking monitoring state: {exc}")
                return

            api_url = f"{settings.BASE_URL}{settings.ADMINISTRADORMONITOREO_API_LOG_HTTP_REQUEST}"
            headers = {
                "Authorization": f"Bearer {event_key}",
                "Content-Type": "application/json",
            }
            data = {"uri": uri}

            # Enviar en un hilo con reintentos
            def _do_send_log(api_url, headers, data):
                max_attempts = 3
                timeout = 5
                for attempt in range(1, max_attempts + 1):
                    try:
                        resp = requests.post(api_url, headers=headers, json=data, timeout=timeout)
                        if resp.status_code and 200 <= resp.status_code < 300:
                            logger.debug(f"Successfully sent HTTP log (attempt {attempt}): {data.get('uri')}")
                            return True
                        logger.warning(f"HTTP log send attempt {attempt} failed: status={resp.status_code}")
                    except Exception as exc:
                        logger.warning(f"HTTP log send attempt {attempt} failed: {exc}")

                    if attempt < max_attempts:
                        time.sleep(attempt)

                logger.error(f"Failed to send HTTP log after {max_attempts} attempts: {data.get('uri')}")
                return False

            threading.Thread(target=_do_send_log, args=(api_url, headers, data), daemon=True).start()

        except Exception as exc:
            logger.error(f"Error sending HTTP log: {str(exc)}")

    def validate_url_http(self, event_key, target_url, method="GET"):
        """
        Valida una URL para peticiones HTTP.
        Retorna si debe ser bloqueada y envia logs automaticamente.
        """
        try:
            # Parsear URL para obtener hostname
            try:
                parsed_url = urlparse(target_url)
                hostname = (parsed_url.hostname or parsed_url.netloc or "").lower()

                if not hostname:
                    return {"blocked": True, "reason": "URL invalida"}
            except Exception:
                return {"blocked": True, "reason": "Error parseando URL"}

            # Obtener participant_event y hosts bloqueados
            try:
                participant_event = ParticipantEvent.objects.select_related("event").get(event_key=event_key)
                event = participant_event.event

                # Obtener hosts bloqueados del evento (solo desde BD)
                blocked_hosts = list(
                    BlockedHost.objects.filter(event=event).values_list("website__hostname", flat=True)
                )
                blocked_hosts = [bh.lower() for bh in blocked_hosts if bh]

                # Verificar si esta bloqueado (solo hosts de la BD)
                is_blocked = any(blocked_host in hostname for blocked_host in blocked_hosts)

                if is_blocked:
                    logger.info(f"HTTP URL bloqueada: {hostname} para evento {event.id}")
                    # Enviar log SOLO si esta en monitoreo
                    try:
                        if getattr(participant_event, "is_monitoring", False):
                            cache_key = (event_key, hostname)
                            if self._should_log_block(cache_key):
                                mensaje = f"Intento acceder a {hostname}"
                                self._send_log_to_api(event_key, mensaje)
                                logger.info(f"Log de intento bloqueado enviado: {mensaje}")
                            else:
                                logger.debug(f"Log duplicado evitado para {hostname} y event_key {event_key}")
                        else:
                            logger.debug(f"HTTP Blocked URL detected but participant not monitoring: {target_url}")
                    except Exception as log_error:
                        logger.warning(f"Error enviando log de bloqueo HTTP: {log_error}")
                    return {"blocked": True, "reason": "Sitio no permitido durante la evaluacion", "hostname": hostname}
                # URL permitida - NO enviar log
                logger.debug(f"HTTP URL permitida: {hostname} para evento {event.id}")
                return {"blocked": False, "allowed": True, "hostname": hostname}

            except ParticipantEvent.DoesNotExist:
                logger.error(f"ParticipantEvent no encontrado para event_key: {event_key}")
                return {"blocked": True, "reason": "Evento no encontrado"}

        except Exception as exc:
            logger.error(f"Error en validate_url_http: {str(exc)}")
            # En caso de error, bloquear por seguridad
            return {"blocked": True, "reason": "Error interno del servidor"}
