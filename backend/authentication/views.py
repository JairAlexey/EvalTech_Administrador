import json
from django.contrib.auth.hashers import check_password, make_password
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.core.validators import validate_email
from django.core.exceptions import ValidationError
import jwt
import datetime
from django.conf import settings
from .models import UserRole, CustomUser
import hashlib
from events.models import Event

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


@csrf_exempt
@require_POST
def login_view(request):
    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")
        if not email or not password:
            return JsonResponse({"error": "Email y contraseña requeridos"}, status=400)

        user = CustomUser.objects.filter(email=email).first()
        if not user:
            return JsonResponse({"error": "Credenciales inválidas"}, status=401)

        # Primero intenta con los hashers de Django
        if not user.check_password(password):
            # Fallback: por si tienes SHA-256 plano desde la migración 0002
            if user.password == hashlib.sha256(password.encode("utf-8")).hexdigest():
                user.set_password(password)
                user.save(update_fields=["password"])
            else:
                return JsonResponse({"error": "Credenciales inválidas"}, status=401)

        token = generate_token(user)
        return JsonResponse({"token": token, "user": get_user_data(user)})
    except json.JSONDecodeError:
        return JsonResponse({"error": "JSON inválido"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_POST
def verify_token_view(request):
    """Vista para verificar si un token JWT es válido"""
    try:
        data = json.loads(request.body)
        token = data.get("token")

        if not token:
            return JsonResponse({"error": "Token no proporcionado"}, status=400)

        payload = verify_token(token)
        if not payload:
            return JsonResponse(
                {"valid": False, "error": "Token inválido o expirado"}, status=401
            )

        # Si el token es válido, buscamos el usuario
        try:
            user = CustomUser.objects.get(id=payload["user_id"])
            return JsonResponse({"valid": True, "user": get_user_data(user)})
        except CustomUser.DoesNotExist:
            return JsonResponse(
                {"valid": False, "error": "Usuario no encontrado"}, status=401
            )

    except json.JSONDecodeError:
        return JsonResponse({"error": "Formato JSON inválido"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_GET
def user_info_view(request):
    """Vista para obtener información del usuario autenticado mediante token JWT"""
    # Obtener el token de los headers de la petición
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return JsonResponse(
            {"error": "Encabezado de autorización inválido"}, status=401
        )

    token = auth_header.split(" ")[1]
    payload = verify_token(token)

    if not payload:
        return JsonResponse({"error": "Token inválido o expirado"}, status=401)

    # Obtener el usuario
    try:
        user = CustomUser.objects.get(id=payload["user_id"])
        return JsonResponse(get_user_data(user))
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Usuario no encontrado"}, status=404)


@csrf_exempt
def role_management_view(request):
    """Vista para gestionar los roles de usuario"""
    auth_header = request.headers.get("Authorization", "")

    if not auth_header.startswith("Bearer "):
        return JsonResponse(
            {"error": "Encabezado de autorización inválido"}, status=401
        )

    token = auth_header.split(" ")[1]
    payload = verify_token(token)

    if not payload:
        return JsonResponse({"error": "Token inválido o expirado"}, status=401)

    # Verificar que el usuario sea superadmin (solo superadmin puede gestionar roles)
    try:
        admin_user = CustomUser.objects.get(id=payload["user_id"])
        try:
            admin_role = UserRole.objects.get(user=admin_user)
            if admin_role.role != "superadmin":
                return JsonResponse(
                    {"error": "No tienes permisos para gestionar roles"}, status=403
                )
        except UserRole.DoesNotExist:
            return JsonResponse({"error": "No tienes un rol asignado"}, status=403)

    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Usuario no encontrado"}, status=404)

    # Ahora procesamos la solicitud
    if request.method == "GET":
        # Obtener la lista de usuarios con sus roles
        users = CustomUser.objects.all()
        user_list = []

        for user in users:
            user_data = {
                "id": user.id,
                "email": user.email,
                "firstName": user.first_name,
                "lastName": user.last_name,
            }

            try:
                user_role = UserRole.objects.get(user=user)
                user_data["role"] = user_role.role
                user_data["roleName"] = user_role.get_role_display()
            except UserRole.DoesNotExist:
                user_data["role"] = "sin_rol"
                user_data["roleName"] = "Sin rol asignado"

            user_list.append(user_data)

        return JsonResponse({"users": user_list})

    else:
        return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@require_POST
def create_user_view(request):
    """Vista para crear un nuevo usuario con rol asignado (solo superadmin)"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JsonResponse(
            {"error": "Encabezado de autorización inválido"}, status=401
        )

    token = auth_header.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        return JsonResponse({"error": "Token inválido o expirado"}, status=401)

    # Verificar que el usuario sea superadmin
    try:
        admin_user = CustomUser.objects.get(id=payload["user_id"])
        admin_role = UserRole.objects.get(user=admin_user)
        if admin_role.role != "superadmin":
            return JsonResponse(
                {"error": "No tienes permisos para crear usuarios"}, status=403
            )
    except (CustomUser.DoesNotExist, UserRole.DoesNotExist):
        return JsonResponse({"error": "No tienes permisos"}, status=403)

    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")
        first_name = data.get("firstName", "")
        last_name = data.get("lastName", "")
        role = data.get("role")

        # Validar que hay valores en campos
        field_names = {
            "firstName": "nombre",
            "lastName": "apellidos",
            "email": "correo electrónico",
            "role": "rol",
        }
        required_fields = ["firstName", "lastName", "email", "role"]
        for field in required_fields:
            if not data.get(field):
                return JsonResponse(
                    {
                        "error": f"El campo {field_names.get(field, field)} es obligatorio"
                    },
                    status=400,
                )

        # Validar formato de email
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse(
                {"error": "El correo electrónico no es válido."}, status=400
            )

        # Validación de longitud mínima de contraseña
        if len(password) < 4:
            return JsonResponse(
                {"error": "La contraseña debe tener al menos 4 caracteres"}, status=400
            )

        # Verificar rol asignado
        if role not in ["admin", "evaluator"]:
            return JsonResponse({"error": "Rol inválido"}, status=400)

        # Verificar si ya existe el usuario
        if CustomUser.objects.filter(email=email).exists():
            return JsonResponse({"error": "El email ya está registrado"}, status=400)

        # Crear usuario
        user = CustomUser.objects.create(
            email=email,
            password=make_password(password),
            first_name=first_name,
            last_name=last_name,
        )

        # Asignar rol
        UserRole.objects.create(user=user, role=role)

        return JsonResponse({"success": True, "user": get_user_data(user)}, status=201)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Formato JSON inválido"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def delete_user_view(request, user_id):
    """Endpoint para eliminar un usuario (solo superadmin)"""
    if request.method != "DELETE":
        return JsonResponse({"error": "Método no permitido"}, status=405)

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JsonResponse(
            {"error": "Encabezado de autorización inválido"}, status=401
        )

    token = auth_header.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        return JsonResponse({"error": "Token inválido o expirado"}, status=401)

    # Verificar permisos de superadmin
    try:
        admin_user = CustomUser.objects.get(id=payload["user_id"])
        admin_role = UserRole.objects.get(user=admin_user)
        if admin_role.role != "superadmin":
            return JsonResponse(
                {"error": "No tienes permisos para eliminar usuarios"}, status=403
            )
    except (CustomUser.DoesNotExist, UserRole.DoesNotExist):
        return JsonResponse({"error": "No tienes permisos"}, status=403)

    # No permitir que el superadmin se elimine a sí mismo
    if admin_user.id == user_id:
        return JsonResponse({"error": "No puedes eliminarte a ti mismo"}, status=400)

    try:
        user = CustomUser.objects.get(id=user_id)
        try:
            user.delete()
            return JsonResponse(
                {"success": True, "message": "Usuario eliminado correctamente"}
            )
        except Exception as e:
            from django.db.models.deletion import RestrictedError

            if isinstance(e, RestrictedError):
                return JsonResponse(
                    {
                        "error": "No se puede eliminar el usuario porque está asignado como evaluador en uno o más eventos."
                    },
                    status=400,
                )
            raise
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Usuario no encontrado"}, status=404)


@csrf_exempt
@require_POST
def edit_user_view(request, user_id):
    """Endpoint para editar datos de usuario (solo superadmin)"""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return JsonResponse(
            {"error": "Encabezado de autorización inválido"}, status=401
        )
    token = auth_header.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        return JsonResponse({"error": "Token inválido o expirado"}, status=401)

    # Verificar permisos de superadmin
    try:
        admin_user = CustomUser.objects.get(id=payload["user_id"])
        admin_role = UserRole.objects.get(user=admin_user)
        if admin_role.role != "superadmin":
            return JsonResponse(
                {"error": "No tienes permisos para editar usuarios"}, status=403
            )
    except (CustomUser.DoesNotExist, UserRole.DoesNotExist):
        return JsonResponse({"error": "No tienes permisos"}, status=403)

    try:
        user = CustomUser.objects.get(id=user_id)

        try:
            # No permitir editar a un superadmin
            user_role = UserRole.objects.get(user=user)
            if user_role.role == "superadmin":
                return JsonResponse(
                    {"error": "No puedes editar un usuario superadmin"}, status=400
                )

            # No permitir editar a un evaluador con eventos
            if user_role.role == "evaluator":
                if Event.objects.filter(evaluator=user).exists():
                    return JsonResponse(
                        {
                            "error": "No puedes editar un usuario evaluador que tiene eventos asignados."
                        },
                        status=400,
                    )
        except UserRole.DoesNotExist:
            pass

        # Datos enviados
        data = json.loads(request.body)
        first_name = data.get("firstName")
        last_name = data.get("lastName")
        email = data.get("email")
        password = data.get("password")
        role = data.get("role")

        # Validaciones requeridas
        field_names = {
            "firstName": "nombre",
            "lastName": "apellidos",
            "email": "correo electrónico",
            "role": "rol",
        }
        required_fields = ["firstName", "lastName", "email", "role"]
        for field in required_fields:
            if not data.get(field):
                return JsonResponse(
                    {
                        "error": f"El campo {field_names.get(field, field)} es obligatorio"
                    },
                    status=400,
                )

        # Validar formato de email
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse(
                {"error": "El correo electrónico no es válido."}, status=400
            )

        # Validar caracteres en contrasena
        if password and len(password) < 4:
            return JsonResponse(
                {"error": "La contraseña debe tener al menos 4 caracteres"}, status=400
            )

        # Verificar rol asignado
        if role not in ["admin", "evaluator"]:
            return JsonResponse({"error": "Rol inválido"}, status=400)

        # Verificar si ya existe el usuario con ese email (y no es el mismo que se está editando)
        if CustomUser.objects.filter(email=email).exclude(id=user_id).exists():
            return JsonResponse({"error": "El email ya está registrado"}, status=400)

        # Actualizar solo si el valor cambia
        if user.first_name != first_name:
            user.first_name = first_name
        if user.last_name != last_name:
            user.last_name = last_name
        if user.email != email:
            user.email = email
        if password:
            user.set_password(password)
        user.save()

        # Actualizar el rol si corresponde
        try:
            user_role = UserRole.objects.get(user=user)
            if user_role.role != role:
                user_role.role = role
                user_role.save()
        except UserRole.DoesNotExist:
            UserRole.objects.create(user=user, role=role)

        return JsonResponse({"success": True, "user": get_user_data(user)})
    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Usuario no encontrado"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def evaluator_users(request):
    if request.method == "GET":
        evaluators = UserRole.objects.filter(role="evaluator")
        users = [
            {
                "id": str(er.user.id),
                "name": f"{er.user.first_name} {er.user.last_name}".strip()
                or er.user.email,
            }
            for er in evaluators
        ]
        return JsonResponse({"users": users})
    return JsonResponse({"error": "Método no permitido"}, status=405)


@csrf_exempt
@require_POST
def update_profile_view(request):
    """Vista para actualizar el perfil del usuario autenticado"""
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
        data = json.loads(request.body)

        first_name = data.get("firstName")
        last_name = data.get("lastName")
        email = data.get("email")
        current_password = data.get("currentPassword")
        new_password = data.get("newPassword")

        # Validar que hay valores en campos obligatorios
        field_names = {
            "firstName": "nombre",
            "lastName": "apellidos",
            "email": "correo electrónico",
        }
        required_fields = ["firstName", "lastName", "email"]
        for field in required_fields:
            if not data.get(field):
                return JsonResponse(
                    {
                        "error": f"El campo {field_names.get(field, field)} es obligatorio"
                    },
                    status=400,
                )

        # Validar formato de email
        try:
            validate_email(email)
        except ValidationError:
            return JsonResponse(
                {"error": "El correo electrónico no es válido"}, status=400
            )

        # Verificar si ya existe otro usuario con ese email
        if CustomUser.objects.filter(email=email).exclude(id=user.id).exists():
            return JsonResponse({"error": "El email ya está registrado"}, status=400)

        # Si se proporciona nueva contraseña, validar contraseña actual
        if new_password:
            if not current_password:
                return JsonResponse(
                    {"error": "Debes ingresar tu contraseña actual para cambiarla"},
                    status=400,
                )

            if not user.check_password(current_password):
                return JsonResponse(
                    {"error": "La contraseña actual es incorrecta"}, status=400
                )

            if len(new_password) < 4:
                return JsonResponse(
                    {"error": "La nueva contraseña debe tener al menos 4 caracteres"},
                    status=400,
                )

            if current_password == new_password:
                return JsonResponse(
                    {"error": "La nueva contraseña debe ser diferente a la actual"},
                    status=400,
                )

            user.set_password(new_password)

        # Actualizar datos básicos
        user.first_name = first_name
        user.last_name = last_name
        user.email = email
        user.save()

        return JsonResponse(
            {
                "success": True,
                "message": "Perfil actualizado correctamente",
                "user": get_user_data(user),
            }
        )

    except CustomUser.DoesNotExist:
        return JsonResponse({"error": "Usuario no encontrado"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Formato JSON inválido"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@require_POST
def refresh_token_view(request):
    """Vista para renovar el token JWT del usuario si está activo"""
    try:
        data = json.loads(request.body)
        token = data.get("token")

        if not token:
            return JsonResponse({"error": "Token no proporcionado"}, status=400)

        payload = verify_token(token)
        if not payload:
            # Token expirado o inválido - no se puede renovar
            return JsonResponse(
                {"error": "Token inválido o expirado. Por favor, inicia sesión nuevamente."},
                status=401
            )

        # Si el token es válido, buscar el usuario y generar un nuevo token
        try:
            user = CustomUser.objects.get(id=payload["user_id"])
            new_token = generate_token(user)
            return JsonResponse({"token": new_token, "user": get_user_data(user)})
        except CustomUser.DoesNotExist:
            return JsonResponse({"error": "Usuario no encontrado"}, status=404)

    except json.JSONDecodeError:
        return JsonResponse({"error": "Formato JSON inválido"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
