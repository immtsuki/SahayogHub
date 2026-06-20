"""
URL patterns for the accounts app.

All routes are prefixed with /api/auth/ (set in core/urls.py).
"""

from django.urls import path
from .views import (
    RegisterView,
    LoginView,
    RefreshTokenView,
    LogoutView,
    MeView,
    UpdateProfileView,
    ChangePasswordView,
)

urlpatterns = [
    # ── Auth ──────────────────────────────────────────────────────────────────
    path("signup/",          RegisterView.as_view(),      name="auth-signup"),
    path("login/",           LoginView.as_view(),          name="auth-login"),
    path("token/refresh/",   RefreshTokenView.as_view(),   name="auth-token-refresh"),
    path("logout/",          LogoutView.as_view(),         name="auth-logout"),

    # ── Profile ───────────────────────────────────────────────────────────────
    path("me/",              MeView.as_view(),             name="auth-me"),
    path("me/update/",       UpdateProfileView.as_view(),  name="auth-me-update"),
    path("me/change-password/", ChangePasswordView.as_view(), name="auth-change-password"),
]
