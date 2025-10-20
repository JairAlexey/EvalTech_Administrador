import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST, require_GET
from django.middleware.csrf import get_token
from django.contrib.auth.decorators import login_required
import jwt
import datetime
import os
from django.conf import settings
from .models import UserRole

# Clave secreta para JWT - en producción debe estar en variables de entorno
JWT_SECRET = getattr(settings, "SECRET_KEY", "django-insecure-token")
JWT_ALGORITHM = "HS256"
JWT_EXP_DELTA_SECONDS = 60 * 60 * 24  # 24 horas


def generate_token(user):
    """Genera un token JWT para el usuario"""
    payload = {
        "user_id": user.id,
        "username": user.username,
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
        "username": user.username,
        "email": user.email,
        "firstName": user.first_name,
        "lastName": user.last_name,
        "isStaff": user.is_staff,
        "role": role,
    }


@csrf_exempt
@require_POST
def login_view(request):
    """Vista para autenticar un usuario y devolver un token JWT"""
    try:
        data = json.loads(request.body)
        username = data.get(
            "email"
        )  # El frontend envía 'email' pero usaremos como username
        password = data.get("password")

        if not username or not password:
            return JsonResponse(
                {"error": "Se requieren email y contraseña"}, status=400
            )

        # Intentamos autenticar con el email como username
        user = authenticate(username=username, password=password)

        # Si no funciona, intentamos buscar por email (asumiendo que el username podría ser diferente al email)
        if not user:
            try:
                user_obj = User.objects.get(email=username)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                pass

        if not user:
            return JsonResponse({"error": "Credenciales inválidas"}, status=401)

        # Generar token JWT
        token = generate_token(user)

        # Login del usuario en la sesión de Django (opcional si solo usas JWT)
        login(request, user)

        return JsonResponse({"token": token, "user": get_user_data(user)})
    except json.JSONDecodeError:
        return JsonResponse({"error": "Formato JSON inválido"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
def logout_view(request):
    """Vista para cerrar sesión"""
    logout(request)
    return JsonResponse({"message": "Sesión cerrada correctamente"})


@csrf_exempt
@require_POST
def register_view(request):
    """Vista para registrar un nuevo usuario"""
    try:
        data = json.loads(request.body)
        username = data.get("email")  # Usamos el email como username
        email = data.get("email")
        password = data.get("password")
        first_name = data.get("firstName", "")
        last_name = data.get("lastName", "")

        if not username or not email or not password:
            return JsonResponse(
                {"error": "Se requieren email y contraseña"}, status=400
            )

        # Verificar si ya existe un usuario con ese email o username
        if User.objects.filter(username=username).exists():
            return JsonResponse(
                {"error": "El nombre de usuario ya está en uso"}, status=400
            )

        if User.objects.filter(email=email).exists():
            return JsonResponse({"error": "El email ya está registrado"}, status=400)

        # Crear el usuario
        user = User.objects.create_user(
            username=username,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # El nuevo usuario no tiene rol asignado inicialmente
        # No creamos un UserRole aquí, lo asignará un administrador

        # Generar token JWT
        token = generate_token(user)

        # Login del usuario recién creado
        login(request, user)

        return JsonResponse({"token": token, "user": get_user_data(user)}, status=201)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Formato JSON inválido"}, status=400)
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
            user = User.objects.get(id=payload["user_id"])
            return JsonResponse({"valid": True, "user": get_user_data(user)})
        except User.DoesNotExist:
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
        user = User.objects.get(id=payload["user_id"])
        return JsonResponse(get_user_data(user))
    except User.DoesNotExist:
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
        admin_user = User.objects.get(id=payload["user_id"])
        try:
            admin_role = UserRole.objects.get(user=admin_user)
            if admin_role.role != "superadmin":
                return JsonResponse(
                    {"error": "No tienes permisos para gestionar roles"}, status=403
                )
        except UserRole.DoesNotExist:
            return JsonResponse({"error": "No tienes un rol asignado"}, status=403)

    except User.DoesNotExist:
        return JsonResponse({"error": "Usuario no encontrado"}, status=404)

    # Ahora procesamos la solicitud
    if request.method == "GET":
        # Obtener la lista de usuarios con sus roles
        users = User.objects.all()
        user_list = []

        for user in users:
            user_data = {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "firstName": user.first_name,
                "lastName": user.last_name,
                "isStaff": user.is_staff,
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

    elif request.method == "POST":
        try:
            data = json.loads(request.body)
            user_id = data.get("userId")
            role = data.get("role")

            if not user_id or not role:
                return JsonResponse(
                    {"error": "Se requiere ID de usuario y rol"}, status=400
                )

            if role not in ["superadmin", "admin", "evaluator"]:
                return JsonResponse({"error": "Rol inválido"}, status=400)

            try:
                target_user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return JsonResponse({"error": "Usuario no encontrado"}, status=404)

            # Actualizar o crear el rol del usuario
            user_role, created = UserRole.objects.update_or_create(
                user=target_user, defaults={"role": role}
            )

            return JsonResponse(
                {
                    "success": True,
                    "message": f"Rol actualizado a {user_role.get_role_display()}",
                    "user": get_user_data(target_user),
                }
            )

        except json.JSONDecodeError:
            return JsonResponse({"error": "Formato JSON inválido"}, status=400)
        except Exception as e:
            return JsonResponse({"error": str(e)}, status=500)
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
        admin_user = User.objects.get(id=payload["user_id"])
        admin_role = UserRole.objects.get(user=admin_user)
        if admin_role.role != "superadmin":
            return JsonResponse(
                {"error": "No tienes permisos para crear usuarios"}, status=403
            )
    except (User.DoesNotExist, UserRole.DoesNotExist):
        return JsonResponse({"error": "No tienes permisos"}, status=403)

    try:
        data = json.loads(request.body)
        email = data.get("email")
        password = data.get("password")
        first_name = data.get("firstName", "")
        last_name = data.get("lastName", "")
        role = data.get("role")

        if not all([email, password, role]):
            return JsonResponse({"error": "Faltan campos requeridos"}, status=400)

        if role not in ["admin", "evaluator"]:
            return JsonResponse({"error": "Rol inválido"}, status=400)

        # Verificar si ya existe el usuario
        if User.objects.filter(email=email).exists():
            return JsonResponse({"error": "El email ya está registrado"}, status=400)

        # Crear usuario
        user = User.objects.create_user(
            username=email,
            email=email,
            password=password,
            first_name=first_name,
            last_name=last_name,
        )

        # Asignar rol inmediatamente
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

    print("hola")
    token = auth_header.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        return JsonResponse({"error": "Token inválido o expirado"}, status=401)

    # Verificar permisos de superadmin
    try:
        admin_user = User.objects.get(id=payload["user_id"])
        admin_role = UserRole.objects.get(user=admin_user)
        if admin_role.role != "superadmin":
            return JsonResponse(
                {"error": "No tienes permisos para eliminar usuarios"}, status=403
            )
    except (User.DoesNotExist, UserRole.DoesNotExist):
        return JsonResponse({"error": "No tienes permisos"}, status=403)

    # No permitir que el superadmin se elimine a sí mismo
    if admin_user.id == user_id:
        return JsonResponse({"error": "No puedes eliminarte a ti mismo"}, status=400)

    try:
        user = User.objects.get(id=user_id)
        user.delete()
        return JsonResponse(
            {"success": True, "message": "Usuario eliminado correctamente"}
        )
    except User.DoesNotExist:
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
        admin_user = User.objects.get(id=payload["user_id"])
        admin_role = UserRole.objects.get(user=admin_user)
        if admin_role.role != "superadmin":
            return JsonResponse(
                {"error": "No tienes permisos para editar usuarios"}, status=403
            )
    except (User.DoesNotExist, UserRole.DoesNotExist):
        return JsonResponse({"error": "No tienes permisos"}, status=403)

    try:
        user = User.objects.get(id=user_id)
        # No permitir editar a un superadmin
        try:
            user_role = UserRole.objects.get(user=user)
            if user_role.role == "superadmin":
                return JsonResponse(
                    {"error": "No puedes editar un usuario superadmin"}, status=400
                )
        except UserRole.DoesNotExist:
            pass
        data = json.loads(request.body)
        user.first_name = data.get("firstName", user.first_name)
        user.last_name = data.get("lastName", user.last_name)
        user.email = data.get("email", user.email)
        password = data.get("password")
        print(password)
        if password:
            user.set_password(password)
        user.save()
        return JsonResponse({"success": True, "user": get_user_data(user)})
    except User.DoesNotExist:
        return JsonResponse({"error": "Usuario no encontrado"}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
