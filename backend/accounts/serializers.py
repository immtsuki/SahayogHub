"""
Serializers for the accounts app.

Covers:
- User registration
- Public user profile (read)
- Profile update (partial)
- Custom JWT token pair (adds user info to token response)
- Change password
"""

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


# ─── JWT ──────────────────────────────────────────────────────────────────────

class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Extends the default login response to include basic user info
    alongside the access / refresh tokens.

    Response shape:
    {
        "access":  "<token>",
        "refresh": "<token>",
        "user": {
            "id": 1,
            "email": "...",
            "full_name": "...",
            "district": "..."
        }
    }
    """

    def validate(self, attrs):
        data = super().validate(attrs)

        # Append user details to the response
        data["user"] = {
            "id": self.user.id,
            "email": self.user.email,
            "full_name": self.user.full_name,
            "district": self.user.district,
            "profile_photo": (
                self.user.profile_photo.url if self.user.profile_photo else None
            ),
        }
        return data


# ─── Registration ─────────────────────────────────────────────────────────────

class RegisterSerializer(serializers.ModelSerializer):
    """Handles new user sign-up. Password is write-only and validated."""

    password = serializers.CharField(
        write_only=True, required=True, validators=[validate_password]
    )
    password2 = serializers.CharField(write_only=True, required=True, label="Confirm password")

    class Meta:
        model = User
        fields = [
            "email",
            "full_name",
            "phone",
            "district",
            "password",
            "password2",
        ]

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        return attrs

    def create(self, validated_data):
        # Remove confirmation field before saving
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


# ─── Profile ──────────────────────────────────────────────────────────────────

class UserProfileSerializer(serializers.ModelSerializer):
    """Read-only public view of a user — returned on /me and after registration."""

    profile_photo = serializers.FileField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "full_name",
            "phone",
            "district",
            "profile_photo",
            "date_joined",
        ]
        read_only_fields = fields


class UpdateProfileSerializer(serializers.ModelSerializer):
    """Allows partial update of mutable profile fields."""

    class Meta:
        model = User
        fields = ["full_name", "phone", "district", "profile_photo"]

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


# ─── Change Password ──────────────────────────────────────────────────────────

class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(required=True, write_only=True)
    new_password = serializers.CharField(
        required=True, write_only=True, validators=[validate_password]
    )
    new_password2 = serializers.CharField(required=True, write_only=True, label="Confirm new password")

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password": "Passwords do not match."})
        return attrs

    def validate_old_password(self, value):
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Old password is incorrect.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.save()
        return user
