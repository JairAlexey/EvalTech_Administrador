from django.http import JsonResponse
from functools import wraps
from .models import CustomUser, UserRole
import jwt
import datetime
from django.conf import settings

# Clave secreta para JWT
JWT_SECRET = getattr(settings, "SECRET_KEY", "django-insecure-token")
JWT_ALGORITHM = "HS256"
JWT_EXP_DELTA_SECONDS = 1800  # 30 minutos (1800 segundos)


def generate_token(user):
    """Genera un token JWT para el usuario"""
    payload = {
        "user_id": user.id,
        "email": user.email,  # Cambiar de username a email
        "exp": datetime.datetime.utcnow()
        + datetime.timedelta(seconds=JWT_EXP_DELTA_SECONDS),
    }
    token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return token


def verify_token(token):
    """Verifica un token JWT y devuelve el payload si es válido"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_data(user):
    """Helper function to get user data with role"""
    try:
        user_role = UserRole.objects.get(user=user)
        role = user_role.role
    except UserRole.DoesNotExist:
        role = "sin_rol"

    return {
        "id": user.id,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "role": role,
    }


def jwt_required(roles=None):
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            auth_header = request.headers.get("Authorization", "")
            if not auth_header.startswith("Bearer "):
                return JsonResponse(
                    {"error": "Encabezado de autorización inválido"}, status=401
                )
            token = auth_header.split(" ")[1]
            payload = verify_token(token)
            if not payload:
                return JsonResponse({"error": "Token inválido o expirado"}, status=401)
            try:
                user = CustomUser.objects.get(id=payload["user_id"])
                if roles:
                    user_role = UserRole.objects.get(user=user)
                    if user_role.role not in roles:
                        return JsonResponse(
                            {
                                "error": f"Se requiere uno de los roles: {', '.join(roles)}"
                            },
                            status=403,
                        )
                request.user = user
            except (CustomUser.DoesNotExist, UserRole.DoesNotExist):
                return JsonResponse(
                    {"error": "Usuario o rol no encontrado"}, status=403
                )
            return view_func(request, *args, **kwargs)

        return _wrapped_view

    return decorator
