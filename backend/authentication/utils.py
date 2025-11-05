from django.http import JsonResponse
from functools import wraps
from .models import CustomUser, UserRole
from .views import verify_token


def jwt_required(role=None):
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
                if role:
                    user_role = UserRole.objects.get(user=user)
                    if user_role.role != role:
                        return JsonResponse(
                            {"error": f"Se requiere rol {role}"}, status=403
                        )
                request.user = user  # Puedes usar esto en la vista
            except (CustomUser.DoesNotExist, UserRole.DoesNotExist):
                return JsonResponse(
                    {"error": "Usuario o rol no encontrado"}, status=403
                )
            return view_func(request, *args, **kwargs)

        return _wrapped_view

    return decorator
