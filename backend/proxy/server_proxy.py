import socket
import threading
import logging
import os
import json
import time
from urllib.parse import urlparse
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
import requests
from administradormonitoreo import settings
from .models import AssignedPort
from events.models import BlockedHost, ParticipantEvent, Participant, ProxyUpdateSignal

logger = logging.getLogger(__name__)

class DynamicProxyManager:
    _instance = None
    PORT_RANGE = (20001, 30000)
    
    def __new__(cls):
        if not cls._instance:
            cls._instance = super().__new__(cls)
            cls._instance.active_proxies = {}
            cls._instance.gateway_running = False
        return cls._instance

    def start_gateway(self, host='127.0.0.1', port=20000):
        self.gateway_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.gateway_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            self.gateway_socket.bind((host, port))
            self.gateway_socket.listen(10)
            self.gateway_running = True
            print(f"🌐 | Gateway listening on {host}:{port}")
            logger.info(f"🌐 | Gateway listening on {host}:{port}")

            gateway_thread = threading.Thread(
                target=self._gateway_loop,
                daemon=True
            )
            gateway_thread.start()
            
            # Iniciar monitor de señales para comunicación entre procesos
            self._start_signal_monitor()
            
        except Exception as e:
            logger.error(f"Failed to start gateway: {str(e)}")
            raise

    def _gateway_loop(self):
        while self.gateway_running:
            try:
                client, addr = self.gateway_socket.accept()
                logger.debug(f"New connection from {addr}")
                threading.Thread(
                    target=self._handle_gateway_connection,
                    args=(client, addr),
                    daemon=True
                ).start()
                
            except Exception as e:
                if self.gateway_running:
                    logger.error(f"Gateway error: {str(e)}")

    def _handle_gateway_connection(self, client_socket, address):
        try:
            event_key = self._authenticate_client(client_socket)
            if not event_key:
                return
            assigned_port = self._assign_dynamic_port(event_key)
            # _assign_dynamic_port ahora programa el arranque del ProxyInstance
            # usando transaction.on_commit para evitar condiciones de carrera.
            
            response = f"ASSIGNED_PORT:{assigned_port}"
            client_socket.send(response.encode('utf-8'))
            
        except Exception as e:
            logger.error(f"Error handling connection: {str(e)}")
            client_socket.send(b'ERROR')
        finally:
            client_socket.close()
            
    def _authenticate_client(self, client_socket):
        try:
            data = client_socket.recv(1024).decode('utf-8').strip()
            print(f"[BACKEND] Raw received data:\n{data}\n{'-'*50}")
            
            headers = data.split('\r\n')
            auth_header = next(
                (h for h in headers if h.startswith('Authorization: Bearer ')),
                None
            )
            
            if not auth_header:
                raise ValueError("Authorization header missing")
                
            print(f"[BACKEND] Auth header found: {auth_header}")
            _, event_key = auth_header.split('Bearer ', 1)
            return self._validate_event_key(event_key.strip())
            
        except Exception as e:
            print(f"[BACKEND] Authentication error: {str(e)}")
            client_socket.send(b'AUTH_FAILED')
            return None

    def _validate_event_key(self, event_key):
        try:
            participant_event = ParticipantEvent.objects.select_related('participant', 'event').get(
                event_key=event_key
            )
            return participant_event.participant
        except ObjectDoesNotExist:
            logger.warning(f"Invalid event key: {event_key}")
            return None

    def _assign_dynamic_port(self, participant):
        with transaction.atomic():
            # Obtener el ParticipantEvent del participante
            try:
                participant_event = ParticipantEvent.objects.get(
                    participant=participant,
                    event__status__in=['programado', 'en_progreso']
                )
            except ParticipantEvent.DoesNotExist:
                logger.error(f"No active event found for participant {participant.id}")
                return None

            # Verificar si ya tiene un puerto asignado (activo o inactivo)
            try:
                assigned_port = AssignedPort.objects.get(
                    participant_event=participant_event
                )
                if not assigned_port.is_active:
                    # Reactivar el puerto existente (persistir cambio)
                    assigned_port.is_active = True
                    assigned_port.save(update_fields=['is_active'])

                # Agendar arranque del proxy tras commit para evitar leer antes de persistir
                transaction.on_commit(lambda: self._start_proxy_instance(assigned_port.port))
                return assigned_port.port
            except AssignedPort.DoesNotExist:
                # Buscar puerto disponible para nueva asignación
                used_ports = set(AssignedPort.objects.values_list('port', flat=True))
                available_ports = [
                    p for p in range(*self.PORT_RANGE)
                    if p not in used_ports
                ]

                if not available_ports:
                    raise RuntimeError("No available ports")

                new_port = available_ports[0]

                # Crear nueva asignación
                assigned_port = AssignedPort.objects.create(
                    participant_event=participant_event,
                    port=new_port,
                    # Crear como activo inmediatamente para evitar condiciones de carrera
                    is_active=True,
                    total_duration=0
                )

                # Agendar arranque del proxy tras commit para asegurar visibilidad en DB
                transaction.on_commit(lambda: self._start_proxy_instance(assigned_port.port))
                return new_port

    def _start_proxy_instance(self, port):
        if port not in self.active_proxies:
            proxy = ProxyInstance(port)
            proxy.start()
            self.active_proxies[port] = proxy

    def update_blocked_hosts_for_event(self, event_id):
        """Actualiza los hosts bloqueados para todas las instancias de proxy activas de un evento"""
        print(f"🔍 | STARTING update_blocked_hosts_for_event for event {event_id}")
        logger.info(f"🔍 | STARTING update_blocked_hosts_for_event for event {event_id}")
        try:
            # Obtener todos los participant_events del evento
            participant_events = ParticipantEvent.objects.filter(event_id=event_id)
            print(f"🔍 | Found {len(participant_events)} participant_events for event {event_id}")
            logger.info(f"🔍 | Found {len(participant_events)} participant_events for event {event_id}")
            
            # Obtener puertos asignados activos para este evento
            active_ports = AssignedPort.objects.filter(
                participant_event__in=participant_events,
                is_active=True
            ).values_list('port', flat=True)
            
            # Obtener la nueva lista de hosts bloqueados
            new_blocked_hosts = list(
                BlockedHost.objects.filter(event_id=event_id)
                .values_list('website__hostname', flat=True)
            )
            
            print(f"🔍 | Event {event_id}: Active ports: {list(active_ports)}")
            print(f"🔍 | Event {event_id}: New blocked hosts from DB: {new_blocked_hosts}")
            print(f"🔍 | Event {event_id}: Available proxy instances: {list(self.active_proxies.keys())}")
            logger.info(f"🔍 | Event {event_id}: Active ports: {list(active_ports)}")
            logger.info(f"🔍 | Event {event_id}: New blocked hosts from DB: {new_blocked_hosts}")
            logger.info(f"🔍 | Event {event_id}: Available proxy instances: {list(self.active_proxies.keys())}")
            
            updated_count = 0
            for port in active_ports:
                if port in self.active_proxies:
                    proxy_instance = self.active_proxies[port]
                    old_blocked_hosts = proxy_instance.blocked_hosts[:]
                    print(f"🔍 | Port {port} - Before update: {old_blocked_hosts}")
                    logger.info(f"🔍 | Port {port} - Before update: {old_blocked_hosts}")
                    proxy_instance.refresh_blocked_hosts(new_blocked_hosts)
                    print(f"🔍 | Port {port} - After update: {proxy_instance.blocked_hosts}")
                    logger.info(f"🔍 | Port {port} - After update: {proxy_instance.blocked_hosts}")
                    updated_count += 1
                else:
                    logger.warning(f"⚠️ | Port {port} not found in active_proxies: {list(self.active_proxies.keys())}")
            
            logger.info(f"🔄 | Updated blocked hosts for {updated_count} active proxy instances (event {event_id})")
            return updated_count
            
        except Exception as e:
            logger.error(f"❌ | Error updating blocked hosts for event {event_id}: {str(e)}")
            logger.error(f"❌ | Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ | Traceback: {traceback.format_exc()}")
            return 0
    
    def _create_update_signal_db(self, event_id):
        """Crea señal en base de datos para comunicación entre procesos"""
        try:
            signal = ProxyUpdateSignal.objects.create(
                event_id=event_id,
                action='update_blocked_hosts'
            )
            print(f"📁 | Created DB signal for event {event_id} (ID: {signal.id})")
            logger.info(f"📁 | Created DB signal for event {event_id}")
            return True
            
        except Exception as e:
            print(f"❌ | Error creating DB signal for event {event_id}: {str(e)}")
            logger.error(f"Error creating DB signal for event {event_id}: {str(e)}")
            return False
    
    def _check_update_signals(self):
        """Verifica señales en base de datos para actualizaciones pendientes"""
        try:
            # Obtener señales no procesadas
            try:
                pending_signals = ProxyUpdateSignal.objects.filter(processed=False).order_by('created_at')
                signal_count = len(pending_signals)
                
                if signal_count > 0:
                    print(f"📁 | [CHECK] Found {signal_count} pending signals to process")
                    logger.info(f"📁 | Found {signal_count} pending signals to process")
            except Exception as db_error:
                logger.error(f"❌ | Database query failed: {db_error}")
                import traceback
                logger.error(f"❌ | DB query traceback: {traceback.format_exc()}")
                return
            
            print(f"📁 | [FOR-LOOP] About to iterate over {signal_count} signals, list: {list(pending_signals)}")
            for signal in pending_signals:
                print(f"📁 | [FOR-LOOP] Processing signal ID {signal.id}")
                try:
                    print(f"📁 | [PROCESS] Starting to process signal ID {signal.id} for event {signal.event_id}")
                    logger.info(f"📁 | Processing DB signal ID {signal.id} for event {signal.event_id}...")
                    
                    # Procesar la actualización
                    print(f"📁 | [PROCESS] About to call update_blocked_hosts_for_event({signal.event_id})")
                    logger.info(f"📁 | About to call update_blocked_hosts_for_event({signal.event_id})")
                    updated_count = self.update_blocked_hosts_for_event(signal.event_id)
                    print(f"📁 | [PROCESS] update_blocked_hosts_for_event returned: {updated_count}")
                    logger.info(f"📁 | Processed signal for event {signal.event_id}: {updated_count} instances updated")
                    
                    # Marcar como procesada
                    signal.processed = True
                    signal.save()
                    
                    logger.info(f"📁 | Processed signal for event {signal.event_id}: {updated_count} instances updated")
                    
                except Exception as e:
                    print(f"❌ | [ERROR] Error processing signal ID {signal.id}: {str(e)}")
                    logger.error(f"Error processing signal ID {signal.id}: {str(e)}")
                    import traceback
                    print(f"❌ | [ERROR] Traceback: {traceback.format_exc()}")
                    logger.error(f"Traceback: {traceback.format_exc()}")
                    # Marcar como procesada para evitar bucles infinitos
                    signal.processed = True
                    signal.save()
            
        except Exception as e:
            logger.error(f"Error checking update signals: {str(e)}")
    
    def _start_signal_monitor(self):
        """Inicia el monitor de archivos de señal en un hilo separado"""
        def signal_monitor_loop():
            print(f"📁 | [THREAD START] Signal monitor thread EXECUTING, gateway_running={self.gateway_running}")
            logger.info(f"📁 | Signal monitor thread started, gateway_running={self.gateway_running}")
            
            # Test de conexión a base de datos
            try:
                from django.db import connection
                connection.ensure_connection()
                test_count = ProxyUpdateSignal.objects.count()
                print(f"📁 | [DB TEST] Database accessible, total signals in DB: {test_count}")
                logger.info(f"📁 | Database test successful, total signals: {test_count}")
            except Exception as db_test_error:
                print(f"❌ | [DB TEST ERROR] Cannot access database: {db_test_error}")
                logger.error(f"❌ | Database test failed: {db_test_error}")
                import traceback
                traceback.print_exc()
            
            if not self.gateway_running:
                print(f"❌ | [THREAD ERROR] gateway_running is False! Thread will not loop.")
                logger.error(f"❌ | gateway_running is False at thread start!")
                return
            
            loop_count = 0
            while self.gateway_running:
                try:
                    loop_count += 1
                    if loop_count % 10 == 0:  # Log cada 5 segundos (10 * 0.5s)
                        print(f"📁 | [LOOP] Signal monitor alive - loop {loop_count}, gateway_running={self.gateway_running}")
                        logger.debug(f"📁 | Signal monitor alive - loop {loop_count}, gateway_running={self.gateway_running}")
                    
                    self._check_update_signals()
                    time.sleep(0.5)  # Verificar cada medio segundo
                except Exception as e:
                    logger.error(f"❌ | Error in signal monitor loop: {str(e)}")
                    import traceback
                    logger.error(f"❌ | Signal monitor traceback: {traceback.format_exc()}")
                    time.sleep(5)  # Esperar más en caso de error
            
            logger.warning(f"📁 | Signal monitor loop ended, gateway_running={self.gateway_running}")
        
        monitor_thread = threading.Thread(
            target=signal_monitor_loop,
            daemon=True,
            name="SignalMonitor"
        )
        print(f"📁 | [MAIN] About to start signal monitor thread, gateway_running={self.gateway_running}")
        monitor_thread.start()
        print(f"📁 | [MAIN] Signal monitor thread started: {monitor_thread.is_alive()}")
        logger.info(f"📁 | Signal monitor started, thread alive: {monitor_thread.is_alive()}")
        logger.info("📁 | Signal monitor started")

    def stop_gateway(self):
        self.gateway_running = False
        if self.gateway_socket:
            self.gateway_socket.close()
        logger.info("🌐 | Gateway stopped")

class ProxyInstance:
    def __init__(self, port):
        self.port = port
        self.socket = None
        self.running = False
        # Contador de conexiones activas manejadas por esta instancia
        self._active_connections = 0
        # Lock para proteger el contador en entornos multihilo
        self._conn_lock = threading.Lock()
        self.blocked_hosts = []
        self.event_key = None
        self.default_blocked_hosts = ["chatgpt.com", "deepseek.com", "gemini.google.com"]
        
        # Registro de conexiones activas: {thread_id: {'host': str, 'sockets': [socket1, socket2]}}
        self._active_connections = {}
        self._connections_lock = threading.Lock()  
        try:
            # Intentar obtener el AssignedPort que ya esté activo
            try:
                self.assigned_port = AssignedPort.objects.select_related(
                    'participant_event__participant',
                    'participant_event__event'
                ).get(port=self.port, is_active=True)
            except AssignedPort.DoesNotExist:
                # Si no existe como activo (posible condición de carrera), obtener por puerto
                # y activarlo para que la instancia del proxy tenga siempre referencia.
                self.assigned_port = AssignedPort.objects.select_related(
                    'participant_event__participant',
                    'participant_event__event'
                ).get(port=self.port)
                if not self.assigned_port.is_active:
                    # Activar y persistir
                    self.assigned_port.is_active = True
                    self.assigned_port.save(update_fields=['is_active'])

            participant_event = self.assigned_port.participant_event
            self.event_key = participant_event.event_key
            # Obtener hosts bloqueados del evento relacionado
            self.blocked_hosts = list(
                BlockedHost.objects.filter(event=participant_event.event)
                .values_list('website__hostname', flat=True)
            )
            # Iniciar comprobación periódica de tiempo
            self._start_time_check()
            # Si no hay hosts bloqueados, deja la lista vacía
        except AssignedPort.DoesNotExist:
            logger.error(f"Assigned port not found for port {self.port}")
        except Exception as e:
            logger.error(f"Error initializing ProxyInstance: {str(e)}")
                
    def start(self):
        self.socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        
        try:
            self.socket.bind(('0.0.0.0', self.port))
            self.socket.listen(10)
            self.running = True
            logger.info(f"🔌 | Proxy started on port {self.port}")
            
            listener_thread = threading.Thread(
                target=self._listen_connections,
                daemon=True
            )
            listener_thread.start()
            
        except Exception as e:
            logger.error(f"Failed to start proxy on {self.port}: {str(e)}")
            raise

    def _listen_connections(self):
        while self.running:
            try:
                client, addr = self.socket.accept()
                threading.Thread(
                    target=self._handle_client,
                    args=(client, addr),
                    daemon=True
                ).start()
                
            except Exception as e:
                if self.running:
                    logger.error(f"Connection error: {str(e)}")

    def _handle_client(self, client_socket, client_address):
        server_socket = None
        try:
            data = client_socket.recv(4096)
            if not data:
                return

            first_line = data.decode().split('\r\n')[0]
            method, url, _ = first_line.split(' ', 2)
            
            # Extraer host y puerto
            if method.upper() == 'CONNECT':
                target_host, target_port_str = url.split(':')
                target_port = int(target_port_str)
                clean_url = url
            else:
                parsed_url = urlparse(url)
                target_host = parsed_url.hostname
                target_port = parsed_url.port or 80
                clean_url = f"{parsed_url.path}?{parsed_url.query}" if parsed_url.query else parsed_url.path

            status_icon = "✅"
            status_msg = ""
            action = "ACCEPTED"
            
            is_blocked = self._is_host_blocked(target_host)
            logger.info(f"🔍 | Port {self.port}: Checking '{target_host}' against blocked hosts {self.blocked_hosts}: {'🚫 BLOCKED' if is_blocked else '✅ ALLOWED'}")
            
            if is_blocked:
                status_icon = "⛔"
                action = "REJECTED"
                status_msg = f"{method} {target_host}"
                
                # Enviar log a la API si la conexión está bloqueada
                # Solo enviar al API si el participante está en modo monitoreo
                try:
                    is_mon = False
                    if hasattr(self, 'assigned_port') and self.assigned_port:
                        try:
                            # Refrescar assigned_port y participant_event desde la BD
                            self.assigned_port.refresh_from_db()
                            try:
                                # refrescar el participante_event relacionado si existe
                                if hasattr(self.assigned_port, 'participant_event') and self.assigned_port.participant_event:
                                    self.assigned_port.participant_event.refresh_from_db()
                            except Exception:
                                # No fatal, solo seguir con la comprobación
                                pass
                            is_mon = getattr(self.assigned_port.participant_event, 'is_monitoring', False)
                        except Exception as e:
                            logger.debug(f"Could not refresh assigned_port before blocked-host log check: {e}")
                    if self.event_key and is_mon:
                        self._send_log_to_api(self.event_key, f"⛔ Blocked URL: {clean_url}")
                        logger.info(f"⛔ | Blocked URL logged: {clean_url}")
                    else:
                        logger.debug(f"Blocked URL detected but participant not monitoring; skipping API log: {clean_url}")
                except Exception as e:
                    logger.error(f"Error checking monitoring state for blocked-host logging: {e}")
                
                client_socket.send(b'HTTP/1.1 403 Forbidden\r\n\r\n')
                client_socket.close()
                return
            else:
                status_icon = "🔗" if method.upper() == "CONNECT" else "📨"
                status_msg = f"{method} {clean_url.split('?')[0]}"

            logger.info(
                f"{status_icon} | {client_address[0]:<15} | "
                f"{status_msg:<45} | "
                f"{action}"
            )

            server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            server_socket.connect((target_host, target_port))
            
            # Registrar conexión activa
            thread_id = threading.get_ident()
            with self._connections_lock:
                self._active_connections[thread_id] = {
                    'host': target_host,
                    'sockets': [client_socket, server_socket]
                }

            # Manejar CONNECT
            if method.upper() == 'CONNECT':
                client_socket.send(b"HTTP/1.1 200 Connection Established\r\n\r\n")
            else:
                server_socket.sendall(data)

            # Relé de tráfico
            self._relay_traffic(client_socket, server_socket)

        except Exception as e:
            logger.error(f"⚠️  | Error: {str(e)}")
        finally:
            # Eliminar conexión del registro
            thread_id = threading.get_ident()
            with self._connections_lock:
                self._active_connections.pop(thread_id, None)
            
            if server_socket:
                server_socket.close()

    def _send_log_to_api(self, event_key, uri):
        try:
            # Evitar enviar logs al API si el participante no está en modo monitoreo
            try:
                if hasattr(self, 'assigned_port') and self.assigned_port:
                    try:
                        # Refrescar assigned_port y participant_event antes de la comprobación
                        self.assigned_port.refresh_from_db()
                        try:
                            if hasattr(self.assigned_port, 'participant_event') and self.assigned_port.participant_event:
                                self.assigned_port.participant_event.refresh_from_db()
                        except Exception:
                            pass
                    except Exception as e:
                        logger.debug(f"Could not refresh assigned_port before sending log: {e}")

                    if not getattr(self.assigned_port.participant_event, 'is_monitoring', False):
                        logger.debug("Skipping log send because participant is not monitoring (refreshed check)")
                        return
            except Exception:
                # Si falla la comprobación, continuar y dejar que el servidor decida
                pass

            api_url = f"{settings.BASE_URL}{settings.ADMINISTRADORMONITOREO_API_LOG_HTTP_REQUEST}"
            headers = {
                "Authorization": f"Bearer {event_key}",
                "Content-Type": "application/json"
            }
            data = {"uri": uri}

            # Enviar en un hilo que haga reintentos y registre el resultado para mayor fiabilidad
            def _do_send_log(api_url, headers, data):
                import time
                max_attempts = 3
                timeout = 5
                for attempt in range(1, max_attempts + 1):
                    try:
                        resp = requests.post(api_url, headers=headers, json=data, timeout=timeout)
                        status = getattr(resp, 'status_code', None)
                        if status and 200 <= status < 300:
                            logger.debug(f"Successfully sent log to API (attempt {attempt}) status={status} uri={data.get('uri')}")
                            return True
                        else:
                            # Registrar fallo pero intentar de nuevo
                            body = getattr(resp, 'text', '') if resp is not None else ''
                            logger.warning(f"Log send attempt {attempt} returned status={status} body={body}")
                    except Exception as e:
                        logger.warning(f"Log send attempt {attempt} failed: {e}")

                    # Backoff simple antes del siguiente intento
                    if attempt < max_attempts:
                        time.sleep(attempt)

                logger.error(f"Failed to send log after {max_attempts} attempts: uri={data.get('uri')}")
                return False

            threading.Thread(target=_do_send_log, args=(api_url, headers, data), daemon=True).start()
            
        except Exception as e:
            logger.error(f"Error sending log: {str(e)}")    

    def close_connections_to_hosts(self, hosts_to_close):
        """Cierra todas las conexiones activas a los hosts especificados"""
        if not hosts_to_close:
            return
        
        closed_count = 0
        with self._connections_lock:
            connections_to_close = []
            for thread_id, conn_info in list(self._active_connections.items()):
                host = conn_info.get('host', '')
                # Verificar si el host de la conexión coincide con alguno de los hosts a cerrar
                if any(host == h or host.endswith(f".{h}") for h in hosts_to_close):
                    connections_to_close.append((thread_id, conn_info))
            
            # Cerrar los sockets
            for thread_id, conn_info in connections_to_close:
                try:
                    for sock in conn_info.get('sockets', []):
                        try:
                            sock.shutdown(socket.SHUT_RDWR)
                            sock.close()
                        except:
                            pass
                    self._active_connections.pop(thread_id, None)
                    closed_count += 1
                    print(f"🔄 | Port {self.port}: Closed connection to {conn_info['host']}")
                    logger.info(f"🔄 | Port {self.port}: Closed connection to {conn_info['host']}")
                except Exception as e:
                    logger.debug(f"Error closing connection: {e}")
        
        if closed_count > 0:
            print(f"🔄 | Port {self.port}: Closed {closed_count} active connections to updated hosts")
            logger.info(f"🔄 | Port {self.port}: Closed {closed_count} active connections")
        
        return closed_count
    
    def refresh_blocked_hosts(self, new_blocked_hosts=None):
        try:
            old_hosts = self.blocked_hosts[:]
            
            if new_blocked_hosts is not None:
                # Usar la lista proporcionada (más eficiente)
                self.blocked_hosts = new_blocked_hosts[:]
            else:
                # Refrescar desde la base de datos
                participant_event = self.assigned_port.participant_event
                self.blocked_hosts = list(
                    BlockedHost.objects.filter(event=participant_event.event)
                    .values_list('website__hostname', flat=True)
                )
            
            # Solo loggear si hubo cambios
            if old_hosts != self.blocked_hosts:
                added_hosts = set(self.blocked_hosts) - set(old_hosts)
                removed_hosts = set(old_hosts) - set(self.blocked_hosts)
                changes = []
                if added_hosts:
                    changes.append(f"Added: {list(added_hosts)}")
                if removed_hosts:
                    changes.append(f"Removed: {list(removed_hosts)}")
                change_summary = ", ".join(changes) if changes else "Modified"
                logger.info(f"🔄 | Port {self.port} blocked hosts updated: {change_summary}")
                logger.debug(f"🔄 | Port {self.port} new blocked hosts: {self.blocked_hosts}")
                
                # Cerrar conexiones activas a los hosts que cambiaron
                hosts_changed = added_hosts | removed_hosts
                if hosts_changed:
                    print(f"🔄 | Port {self.port}: Closing connections to changed hosts: {list(hosts_changed)}")
                    self.close_connections_to_hosts(hosts_changed)
            else:
                logger.debug(f"🔄 | Port {self.port} blocked hosts unchanged: {self.blocked_hosts}")
            
        except Exception as e:
            logger.error(f"Error refreshing blocked hosts for port {self.port}: {str(e)}")

    def _is_host_blocked(self, host):
        """
        Verifica si un host está bloqueado.
        Bloquea el dominio exacto y todos sus subdominios.
        Ejemplo: si 'example.com' está bloqueado, también bloquea 'www.example.com', 'api.example.com', etc.
        """
        for blocked in self.blocked_hosts:
            # Coincidencia exacta del dominio
            if host == blocked:
                return True
            # El host es un subdominio del dominio bloqueado
            if host.endswith(f".{blocked}"):
                return True
            # El dominio bloqueado es un subdominio del host (para casos como *.google.com)
            if blocked.startswith("*."):
                # Remover el wildcard y verificar
                base_domain = blocked[2:]  # Remover "*."
                if host == base_domain or host.endswith(f".{base_domain}"):
                    return True
        return False

    def _relay_traffic(self, client, server):
        def _inc_conn():
            try:
                with self._conn_lock:
                    self._active_connections += 1
                    logger.debug(f"Proxy {self.port} active connections ++ -> {self._active_connections}")
            except Exception:
                pass

        def _dec_conn_and_maybe_deactivate():
            try:
                with self._conn_lock:
                    if self._active_connections > 0:
                        self._active_connections -= 1
                    logger.debug(f"Proxy {self.port} active connections -- -> {self._active_connections}")

                    # Sólo desactivar cuando no queden conexiones activas
                    should_deactivate = self._active_connections == 0
            except Exception as e:
                logger.debug(f"Error decrementing connection counter: {e}")
                should_deactivate = False

            if should_deactivate and hasattr(self, 'assigned_port'):
                    try:
                        from proxy.models import AssignedPort
                        AssignedPort.objects.get(id=self.assigned_port.id)
                        self.assigned_port.refresh_from_db()
                        if self.assigned_port.is_active:
                            logger.info(f"Deactivating AssignedPort {self.assigned_port.port} because no active connections remain")
                            self.assigned_port.deactivate()
                    except AssignedPort.DoesNotExist:
                        logger.debug(f"AssignedPort for port {self.port} no longer exists")
                    except Exception as e:
                        logger.error(f"Error deactivating on connection close: {str(e)}")

        def forward(source, dest, direction):
            from django.utils import timezone
            last_activity = timezone.now()
            # Incrementar contador al iniciar el reenvío
            _inc_conn()
            try:
                while True:
                    data = source.recv(4096)
                    if not data:
                        break
                    dest.sendall(data)
                    # Actualizar last_activity en la base de datos cada 5 minutos
                    now = timezone.now()
                    if (now - last_activity).total_seconds() > 300:  # 5 minutos
                        if hasattr(self, 'assigned_port'):
                            try:
                                self.assigned_port.last_activity = now
                                self.assigned_port.save(update_fields=['last_activity'])
                            except Exception as e:
                                logger.debug(f"Could not save last_activity for port {self.port}: {e}")
                        last_activity = now
            except (ConnectionResetError, BrokenPipeError, OSError) as e:
                logger.debug(f"Relay error ({direction}): {str(e)}") 
            except Exception as e:
                logger.error(f"Unexpected error ({direction}): {str(e)}")
            finally:
                try:
                    source.close()
                except:
                    pass
                try:
                    dest.close()
                except:
                    pass
                # Reducir contador y tal vez desactivar (sólo cuando todas las conexiones cerradas)
                _dec_conn_and_maybe_deactivate()

        threads = [
            threading.Thread(
                target=forward,
                args=(client, server, "Client->Server"),
                daemon=True
            ),
            threading.Thread(
                target=forward,
                args=(server, client, "Server->Client"),
                daemon=True
            )
        ]
        
        for t in threads:
            t.start()
        
        for t in threads:
            t.join()

    def _start_time_check(self):
        """Inicia la comprobación periódica de tiempo"""
        def check_time():
            while self.running:
                try:
                    # Refrescar el objeto assigned_port desde la base de datos
                    self.assigned_port.refresh_from_db()
                    
                    if not self.assigned_port.has_time_remaining():
                        logger.warning(f"Time limit exceeded for port {self.port}")
                        self.stop()
                        break
                except Exception as e:
                    logger.error(f"Error checking time: {str(e)}")
                    break
                import time
                time.sleep(60)  # Comprobar cada minuto

        self.time_check_thread = threading.Thread(
            target=check_time,
            daemon=True
        )
        self.time_check_thread.start()

    def stop(self):
        self.running = False
        if hasattr(self, 'assigned_port'):
            try:
                # Verificar que el assigned_port aún existe en la base de datos
                from proxy.models import AssignedPort
                AssignedPort.objects.get(id=self.assigned_port.id)
                self.assigned_port.refresh_from_db()
                if self.assigned_port.is_active:
                    self.assigned_port.deactivate()
            except AssignedPort.DoesNotExist:
                logger.debug(f"AssignedPort for port {self.port} no longer exists")
            except Exception as e:
                logger.error(f"Error deactivating port: {str(e)}")
        if self.socket:
            self.socket.close()
        logger.info(f"Proxy on port {self.port} stopped")
