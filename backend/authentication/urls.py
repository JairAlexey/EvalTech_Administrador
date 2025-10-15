from django.urls import path
from . import views

urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("register/", views.register_view, name="register"),
    path("verify-token/", views.verify_token_view, name="verify_token"),
    path("user-info/", views.user_info_view, name="user_info"),
    path("roles/", views.role_management_view, name="role_management"),
]
