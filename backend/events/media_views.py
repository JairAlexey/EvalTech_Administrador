import os
import mimetypes
from django.http import HttpResponse, HttpResponseNotFound, Http404
from django.conf import settings
from django.views.decorators.http import require_GET
from django.views.decorators.csrf import csrf_exempt
from wsgiref.util import FileWrapper


@csrf_exempt
@require_GET
def serve_media_file(request, file_path):
    """
    Vista personalizada para servir archivos multimedia con soporte para streaming
    y manejo mejorado de conexiones interrumpidas (broken pipe).
    """
    try:
        # Construir la ruta completa al archivo
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        
        # Verificar que el archivo existe y está dentro del directorio MEDIA_ROOT
        if not os.path.exists(full_path):
            raise Http404("Archivo no encontrado")
            
        if not os.path.abspath(full_path).startswith(os.path.abspath(settings.MEDIA_ROOT)):
            raise Http404("Acceso denegado")
            
        # Obtener información del archivo
        file_size = os.path.getsize(full_path)
        content_type, _ = mimetypes.guess_type(full_path)
        
        # Si no se puede determinar el tipo de contenido, usar binario genérico
        if not content_type:
            content_type = 'application/octet-stream'
            
        # Verificar si es una solicitud de rango (para streaming de video)
        range_header = request.META.get('HTTP_RANGE')
        
        if range_header:
            # Manejar solicitud de rango para streaming
            return handle_range_request(full_path, range_header, content_type, file_size)
        else:
            # Servir archivo completo
            return serve_complete_file(full_path, content_type, file_size)
            
    except (OSError, IOError) as e:
        # Manejar errores de E/O silenciosamente (incluye broken pipe)
        return HttpResponseNotFound()
    except Exception as e:
        return HttpResponseNotFound()


def handle_range_request(file_path, range_header, content_type, file_size):
    """
    Maneja solicitudes de rango para streaming de video.
    """
    try:
        # Parsear el header Range
        range_match = range_header.replace('bytes=', '').split('-')
        start = int(range_match[0]) if range_match[0] else 0
        end = int(range_match[1]) if range_match[1] else file_size - 1
        
        # Validar rangos
        if start >= file_size or end >= file_size:
            response = HttpResponse(status=416)  # Range Not Satisfiable
            response['Content-Range'] = f'bytes */{file_size}'
            return response
            
        # Calcular el tamaño del chunk
        chunk_size = end - start + 1
        
        # Abrir archivo y leer el rango solicitado
        with open(file_path, 'rb') as f:
            f.seek(start)
            data = f.read(chunk_size)
            
        # Crear respuesta con código 206 (Partial Content)
        response = HttpResponse(
            data,
            status=206,
            content_type=content_type
        )
        
        response['Content-Length'] = str(chunk_size)
        response['Content-Range'] = f'bytes {start}-{end}/{file_size}'
        response['Accept-Ranges'] = 'bytes'
        response['Cache-Control'] = 'no-cache'
        
        return response
        
    except (ValueError, OSError, IOError):
        # Si hay error en el parseo o lectura, servir archivo completo
        return serve_complete_file(file_path, content_type, file_size)


def serve_complete_file(file_path, content_type, file_size):
    """
    Sirve el archivo completo con optimizaciones para evitar broken pipe.
    """
    try:
        # Usar FileWrapper para archivos grandes (más eficiente)
        if file_size > 1024 * 1024:  # 1MB
            with open(file_path, 'rb') as f:
                wrapper = FileWrapper(f, 8192)  # Chunks de 8KB
                response = HttpResponse(wrapper, content_type=content_type)
        else:
            # Para archivos pequeños, cargar completamente en memoria
            with open(file_path, 'rb') as f:
                response = HttpResponse(f.read(), content_type=content_type)
        
        response['Content-Length'] = str(file_size)
        response['Accept-Ranges'] = 'bytes'
        response['Cache-Control'] = 'public, max-age=3600'  # Cache por 1 hora
        
        # Headers adicionales para compatibilidad con navegadores
        if content_type.startswith('video/'):
            response['X-Content-Type-Options'] = 'nosniff'
            
        return response
        
    except (OSError, IOError):
        # Manejar broken pipe y otros errores de E/O silenciosamente
        return HttpResponseNotFound()