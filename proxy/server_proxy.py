import socket
import threading
import logging
from urllib.parse import urlparse
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
import requests
from administradormonitoreo import settings
from .models import AssignedPort, Participant
from events.models import BlockedHost

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
            logger.info(f"🌐 | Gateway listening on {host}:{port}")      

            gateway_thread = threading.Thread(
                target=self._gateway_loop,
                daemon=True
            )
            gateway_thread.start()
            
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
            self._start_proxy_instance(assigned_port)
            
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
            return Participant.objects.get(
                event_key=event_key,
            )
        except ObjectDoesNotExist:
            logger.warning(f"Invalid event key: {event_key}")
            return None

    def _assign_dynamic_port(self, participant):
        with transaction.atomic():
            # Limpieza de puertos antiguos
            AssignedPort.objects.filter(
                participant=participant,
                is_active=False
            ).delete()
            
            # Buscar puerto disponible
            used_ports = set(AssignedPort.objects.values_list('port', flat=True))
            available_ports = [
                p for p in range(*self.PORT_RANGE)
                if p not in used_ports
            ]
            
            if not available_ports:
                raise RuntimeError("No available ports")
            
            new_port = available_ports[0]
            
            # Crear asignación
            AssignedPort.objects.update_or_create(
                participant=participant,
                defaults={
                    'port': new_port,
                    'is_active': True
                }
            )
            
            # Marcar el participante como activo
            participant.is_active = True
            participant.save(update_fields=['is_active'])
            
            return new_port

    def _start_proxy_instance(self, port):
        if port not in self.active_proxies:
            proxy = ProxyInstance(port)
            proxy.start()
            self.active_proxies[port] = proxy

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
        self.blocked_hosts = []
        self.event_key = None
        self.default_blocked_hosts = ["chatgpt.com", "deepseek.com", "gemini.google.com"]  
        try:
            assigned_port = AssignedPort.objects.get(port=self.port, is_active=True)
            participant = assigned_port.participant
            self.event_key = participant.event_key
            # Obtener hosts bloqueados del evento relacionado
            self.blocked_hosts = list(
                BlockedHost.objects.filter(event=participant.event)
                .values_list('hostname', flat=True)
            )
            if not self.blocked_hosts: 
                self.blocked_hosts = self.default_blocked_hosts
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
            
            if self._is_host_blocked(target_host):
                status_icon = "⛔"
                action = "REJECTED"
                status_msg = f"{method} {target_host}"
                
                # Enviar log a la API si la conexión está bloqueada
                if self.event_key:
                    self._send_log_to_api(self.event_key, f"⛔ Blocked URL: {clean_url}")
                    logger.info(f"⛔ | Blocked URL logged: {clean_url}")
                
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
            if server_socket:
                server_socket.close()

    def _send_log_to_api(self, event_key, uri):
        try:
            api_url = f"{settings.BASE_URL}{settings.ADMINISTRADORMONITOREO_API_LOG_HTTP_REQUEST}"
            headers = {
                "Authorization": f"Bearer {event_key}",
                "Content-Type": "application/json"
            }
            data = {"uri": uri}
            
            threading.Thread(
                target=requests.post,
                args=(api_url,),
                kwargs={'headers': headers, 'json': data, 'timeout': 3}
            ).start()
            
        except Exception as e:
            logger.error(f"Error sending log: {str(e)}")    

    def _is_host_blocked(self, host):
        return any(host == blocked or host.endswith(f".{blocked}") for blocked in self.blocked_hosts)

    def _relay_traffic(self, client, server):
        def forward(source, dest, direction):
            try:
                while True:
                    data = source.recv(4096)
                    if not data:
                        break
                    dest.sendall(data)
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

    def stop(self):
        self.running = False
        if self.socket:
            self.socket.close()
        logger.info(f"Proxy on port {self.port} stopped")
