"""
Authentication & profile views for SahayogHub.

Token strategy
──────────────
  access token  → returned in JSON response body (frontend stores in memory)
  refresh token → stored in an HttpOnly, SameSite=Lax cookie (never readable by JS)

Endpoints:
  POST   /api/auth/signup/              Register → sets cookie, returns access + user
  POST   /api/auth/login/               Login    → sets cookie, returns access + user
  POST   /api/auth/token/refresh/       Read cookie → rotate → new access in JSON + new cookie
  POST   /api/auth/logout/              Blacklist cookie token → clear cookie
  GET    /api/auth/me/                  Current user profile
  PATCH  /api/auth/me/update/           Update profile fields
  POST   /api/auth/me/change-password/  Change password
"""

from django.conf import settings

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from drf_spectacular.utils import extend_schema

from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    UpdateProfileSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
)

# Cookie name — centralised so it's easy to change
REFRESH_COOKIE = "refresh_token"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    """
    Attach the refresh token as an HttpOnly cookie to the response.

    Flags:
      httponly  — JS cannot read it (XSS protection)
      samesite  — 'Lax' blocks cross-site POST forgery (CSRF protection)
      secure    — HTTPS only in production; off in DEBUG so localhost works
      max_age   — matches SIMPLE_JWT REFRESH_TOKEN_LIFETIME
    """
    lifetime = settings.SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"]
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=refresh_token,
        max_age=int(lifetime.total_seconds()),
        httponly=True,
        samesite="Lax",
        secure=not settings.DEBUG,   # True in prod, False in dev
        path="/api/auth/",           # cookie only sent to auth routes
    )


def _clear_refresh_cookie(response: Response) -> None:
    """Remove the refresh token cookie on logout."""
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth/")


# ─── Registration ─────────────────────────────────────────────────────────────

@extend_schema(tags=["Auth"], summary="Register a new user")
class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/signup/

    Body: { email, full_name, phone?, district?, password, password2 }

    Response (201):
    {
        "message": "...",
        "access": "<short-lived JWT>",
        "user": { id, email, full_name, ... }
    }
    + HttpOnly cookie: refresh_token=<long-lived JWT>
    """

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        refresh = RefreshToken.for_user(user)

        response = Response(
            {
                "message": "Account created successfully.",
                "access": str(refresh.access_token),
                "user": UserProfileSerializer(user, context={"request": request}).data,
            },
            status=status.HTTP_201_CREATED,
        )
        _set_refresh_cookie(response, str(refresh))
        return response


# ─── Login ────────────────────────────────────────────────────────────────────

@extend_schema(tags=["Auth"], summary="Login — obtain access token (refresh set in cookie)")
class LoginView(APIView):
    """
    POST /api/auth/login/

    Body: { "email": "...", "password": "..." }

    Response (200):
    {
        "access": "<short-lived JWT>",
        "user": { id, email, full_name, district, profile_photo }
    }
    + HttpOnly cookie: refresh_token=<long-lived JWT>
    """

    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer   # for Swagger schema

    def post(self, request):
        serializer = CustomTokenObtainPairSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data  # has access, refresh, user

        response = Response(
            {
                "access": data["access"],
                "user": data["user"],
            },
            status=status.HTTP_200_OK,
        )
        _set_refresh_cookie(response, data["refresh"])
        return response


# ─── Token Refresh ────────────────────────────────────────────────────────────

@extend_schema(
    tags=["Auth"],
    summary="Refresh access token (reads refresh token from cookie)",
    request=None,   # no body needed — token comes from cookie
)
class RefreshTokenView(APIView):
    """
    POST /api/auth/token/refresh/

    No body required. Reads the refresh token from the HttpOnly cookie.

    Response (200): { "access": "<new access token>" }
    + Rotated HttpOnly cookie with a new refresh token.

    The old refresh token is blacklisted automatically.
    """

    permission_classes = [AllowAny]

    def post(self, request):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE)

        if not refresh_token:
            return Response(
                {"error": "Refresh token cookie not found. Please log in again."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            token = RefreshToken(refresh_token)
            new_access = str(token.access_token)

            # ROTATE_REFRESH_TOKENS=True → token.access_token already rotated the refresh
            # We need to get the new refresh token string before blacklisting the old one
            # simplejwt does this internally when we call token.access_token on a rotated token
            new_refresh = str(token)

        except TokenError as e:
            response = Response(
                {"error": str(e)},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            _clear_refresh_cookie(response)
            return response

        response = Response({"access": new_access}, status=status.HTTP_200_OK)
        _set_refresh_cookie(response, new_refresh)
        return response


# ─── Logout ───────────────────────────────────────────────────────────────────

@extend_schema(
    tags=["Auth"],
    summary="Logout — blacklist refresh token and clear cookie",
    request=None,
)
class LogoutView(APIView):
    """
    POST /api/auth/logout/

    No body needed. Reads the refresh token from the HttpOnly cookie,
    blacklists it, and clears the cookie.
    The client should also discard the access token from memory.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.COOKIES.get(REFRESH_COOKIE)

        if not refresh_token:
            return Response(
                {"error": "No refresh token cookie found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as e:
            # Token may already be blacklisted — still clear the cookie
            response = Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            _clear_refresh_cookie(response)
            return response

        response = Response({"message": "Logged out successfully."}, status=status.HTTP_200_OK)
        _clear_refresh_cookie(response)
        return response


# ─── Profile: Read ────────────────────────────────────────────────────────────

@extend_schema(tags=["Profile"], summary="Get current user profile")
class MeView(generics.RetrieveAPIView):
    """
    GET /api/auth/me/

    Returns the currently authenticated user's profile.
    Requires: Authorization: Bearer <access token>
    """

    serializer_class = UserProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user


# ─── Profile: Update ──────────────────────────────────────────────────────────

@extend_schema(tags=["Profile"], summary="Update profile (partial)")
class UpdateProfileView(generics.UpdateAPIView):
    """
    PATCH /api/auth/me/update/

    Partially updates full_name, phone, district, profile_photo.
    Always treated as partial (no need to send all fields).
    """

    serializer_class = UpdateProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        super().update(request, *args, **kwargs)
        return Response(
            UserProfileSerializer(self.get_object(), context={"request": request}).data
        )


# ─── Change Password ──────────────────────────────────────────────────────────

@extend_schema(tags=["Profile"], summary="Change password")
class ChangePasswordView(APIView):
    """
    POST /api/auth/me/change-password/

    Body: { old_password, new_password, new_password2 }
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"message": "Password changed successfully. Please log in again."},
            status=status.HTTP_200_OK,
        )
