from django.urls import path
from . import views

urlpatterns = [
    path("login/", views.login_view, name="login"),
    path("logout/", views.logout_view, name="logout"),
    path("create-user/", views.create_user_view, name="create_user"),
    path("delete-user/<int:user_id>/", views.delete_user_view, name="delete_user"),
    path("edit-user/<int:user_id>/", views.edit_user_view, name="edit_user"),
    path("verify-token/", views.verify_token_view, name="verify_token"),
    path("user-info/", views.user_info_view, name="user_info"),
    path("roles/", views.role_management_view, name="role_management"),
]
