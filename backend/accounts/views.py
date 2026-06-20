"""
Authentication & profile views for SahayogHub.

Endpoints exposed:
  POST   /api/auth/signup/           Register a new user
  POST   /api/auth/login/            Obtain access + refresh tokens
  POST   /api/auth/token/refresh/    Get a new access token via refresh token
  POST   /api/auth/logout/           Blacklist the refresh token (logout)
  GET    /api/auth/me/               Get current user profile
  PATCH  /api/auth/me/update/        Update profile fields
  POST   /api/auth/me/change-password/ Change password
"""

from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated

from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError

from drf_spectacular.utils import extend_schema, OpenApiResponse

from .serializers import (
    RegisterSerializer,
    UserProfileSerializer,
    UpdateProfileSerializer,
    ChangePasswordSerializer,
    CustomTokenObtainPairSerializer,
)


# ─── Registration ─────────────────────────────────────────────────────────────

@extend_schema(tags=["Auth"], summary="Register a new user")
class RegisterView(generics.CreateAPIView):
    """
    POST /api/auth/signup/

    Creates a new user account.
    Returns user profile + access & refresh tokens immediately after signup.
    No email verification for now (hackathon scope).
    """

    serializer_class = RegisterSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Auto-issue tokens so the frontend can log in right after signup
        refresh = RefreshToken.for_user(user)

        return Response(
            {
                "message": "Account created successfully.",
                "user": UserProfileSerializer(user, context={"request": request}).data,
                "tokens": {
                    "access": str(refresh.access_token),
                    "refresh": str(refresh),
                },
            },
            status=status.HTTP_201_CREATED,
        )


# ─── Login ────────────────────────────────────────────────────────────────────

@extend_schema(tags=["Auth"], summary="Login — obtain access & refresh tokens")
class LoginView(TokenObtainPairView):
    """
    POST /api/auth/login/

    Body: { "email": "...", "password": "..." }

    Returns:
    {
        "access":  "<short-lived token>",
        "refresh": "<long-lived token>",
        "user": { ... }
    }
    """

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]


# ─── Token Refresh ────────────────────────────────────────────────────────────

@extend_schema(tags=["Auth"], summary="Refresh access token using refresh token")
class RefreshTokenView(TokenRefreshView):
    """
    POST /api/auth/token/refresh/

    Body: { "refresh": "<refresh token>" }

    Returns a new access token (and a new refresh token if ROTATE_REFRESH_TOKENS=True).
    The old refresh token is blacklisted automatically.
    """

    permission_classes = [AllowAny]


# ─── Logout ───────────────────────────────────────────────────────────────────

@extend_schema(tags=["Auth"], summary="Logout — blacklist the refresh token")
class LogoutView(APIView):
    """
    POST /api/auth/logout/

    Body: { "refresh": "<refresh token>" }

    Blacklists the provided refresh token so it can never be used again.
    The client must also delete the access token from its storage.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"error": "Refresh token is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except TokenError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"message": "Logged out successfully."},
            status=status.HTTP_200_OK,
        )


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
        kwargs["partial"] = True  # always partial
        response = super().update(request, *args, **kwargs)
        # Return full profile after update
        return Response(
            UserProfileSerializer(self.get_object(), context={"request": request}).data
        )


# ─── Change Password ──────────────────────────────────────────────────────────

@extend_schema(tags=["Profile"], summary="Change password")
class ChangePasswordView(APIView):
    """
    POST /api/auth/me/change-password/

    Body:
    {
        "old_password": "...",
        "new_password": "...",
        "new_password2": "..."
    }
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
