"""
Custom User model for SahayogHub.

We extend AbstractBaseUser so we can:
- Use email as the login identifier (not username)
- Add civic-specific fields (phone, district, profile photo)
"""

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    """Custom manager — creates users with email instead of username."""

    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("is_active", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    """
    SahayogHub User

    Login field  : email
    Extra fields : full_name, phone, district, profile_photo
    """

    # ── Core fields ──────────────────────────────────────────────────────────
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=150)

    # ── Civic-specific fields ─────────────────────────────────────────────────
    phone = models.CharField(max_length=15, blank=True, null=True)
    district = models.CharField(max_length=100, blank=True, null=True)
    # NOTE: Using FileField instead of ImageField because Pillow doesn't have
    # a prebuilt Python 3.14 wheel yet. Swap to ImageField once Pillow 3.14
    # wheels are available: https://github.com/python-pillow/Pillow/issues/8013
    profile_photo = models.FileField(
        upload_to="profiles/", blank=True, null=True
    )

    # ── Status flags ──────────────────────────────────────────────────────────
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)   # can access /admin

    # ── Timestamps ────────────────────────────────────────────────────────────
    date_joined = models.DateTimeField(default=timezone.now)

    objects = UserManager()

    USERNAME_FIELD = "email"            # used for authentication
    REQUIRED_FIELDS = ["full_name"]     # prompted by createsuperuser

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-date_joined"]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    @property
    def short_name(self):
        return self.full_name.split()[0] if self.full_name else self.email
