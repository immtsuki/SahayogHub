"""
SahayogHub Django Settings
"""

from pathlib import Path
from datetime import timedelta
from decouple import config, Csv

BASE_DIR = Path(__file__).resolve().parent.parent


def env_bool(name, default=False):
    value = config(name, default=default, cast=str)
    normalized = str(value).strip().lower()
    if normalized in {"1", "true", "yes", "on", "debug", "development", "dev"}:
        return True
    if normalized in {"0", "false", "no", "off", "release", "production", "prod"}:
        return False
    return bool(default)

# ─── Security ────────────────────────────────────────────────────────────────

SECRET_KEY = config("SECRET_KEY", default="unsafe-dev-secret-change-in-production")
DEBUG = env_bool("DEBUG", default=True)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="*,localhost,127.0.0.1,192.168.30.123", cast=Csv())

# ─── Applications ─────────────────────────────────────────────────────────────

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",  # enables refresh token blacklisting (logout)
    "corsheaders",
    "drf_spectacular",
    # Local apps
    "accounts",
    "reports",
]

# ─── Middleware ───────────────────────────────────────────────────────────────

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # must be first
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "core.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "core.wsgi.application"

# ─── Database ─────────────────────────────────────────────────────────────────
# Neon PostgreSQL via DATABASE_URL — falls back to SQLite only if not set.

_db_url = config("DATABASE_URL", default="")
if _db_url:
    import dj_database_url  # type: ignore
    _parsed = dj_database_url.parse(_db_url, conn_max_age=600)
    # psycopg v3 driver — required for Python 3.13 (no psycopg2 wheels yet)
    _parsed["ENGINE"] = "django.db.backends.postgresql"
    # Only require SSL for remote (non-localhost) connections
    if "localhost" not in _db_url and "127.0.0.1" not in _db_url:
        _parsed.setdefault("OPTIONS", {})["sslmode"] = "require"
    DATABASES = {"default": _parsed}
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }

# ─── Password Validation ──────────────────────────────────────────────────────

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ─── Internationalisation ─────────────────────────────────────────────────────

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Kathmandu"
USE_I18N = True
USE_TZ = True

# ─── Static & Media Files ─────────────────────────────────────────────────────

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ─── Custom User Model ────────────────────────────────────────────────────────

AUTH_USER_MODEL = "accounts.User"

# ─── Django REST Framework ────────────────────────────────────────────────────

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_RENDERER_CLASSES": (
        "rest_framework.renderers.JSONRenderer",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# ─── DRF Spectacular (OpenAPI / Swagger) ──────────────────────────────────────

SPECTACULAR_SETTINGS = {
    "TITLE": "SahayogHub API",
    "DESCRIPTION": (
        "Unified civic platform for Nepal — Lost & Found, Missing Persons, "
        "Emergency SOS, Road Hazards, Corruption Reporting, and Fundraising."
    ),
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,   # hide the raw /api/schema/ from Swagger UI list

    # JWT bearer auth button in Swagger UI
    "SECURITY": [{"BearerAuth": []}],
    "COMPONENTS": {
        "securitySchemes": {
            "BearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }
    },

    "SWAGGER_UI_SETTINGS": {
        "persistAuthorization": True,   # keeps the token after page refresh
        "displayRequestDuration": True,
        "filter": True,                 # search bar in Swagger UI
    },
    "TAGS": [
        {"name": "Auth", "description": "Registration, login, token refresh, logout"},
        {"name": "Profile", "description": "View and update the authenticated user's profile"},
    ],
}

# ─── Simple JWT ───────────────────────────────────────────────────────────────

SIMPLE_JWT = {
    # Access token is short-lived (default 15 min)
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=config("ACCESS_TOKEN_LIFETIME_MINUTES", default=15, cast=int)
    ),
    # Refresh token is long-lived (default 7 days)
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=config("REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)
    ),
    "ROTATE_REFRESH_TOKENS": True,       # issue a new refresh token on every refresh
    "BLACKLIST_AFTER_ROTATION": True,    # blacklist the old refresh token immediately
    "UPDATE_LAST_LOGIN": True,

    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,

    "AUTH_HEADER_TYPES": ("Bearer",),
    "AUTH_HEADER_NAME": "HTTP_AUTHORIZATION",

    "USER_ID_FIELD": "id",
    "USER_ID_CLAIM": "user_id",
}

# ─── CORS ─────────────────────────────────────────────────────────────────────

DEFAULT_CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
]
CORS_ALLOWED_ORIGINS = list(dict.fromkeys([
    *config("CORS_ALLOWED_ORIGINS", default="", cast=Csv()),
    *DEFAULT_CORS_ALLOWED_ORIGINS,
]))
CORS_ALLOW_CREDENTIALS = True

# AI model services. Django keeps the database flow authoritative and calls these
# FastAPI services opportunistically during report creation.
AI_REDACTION_URL = config("AI_REDACTION_URL", default="http://127.0.0.1:8012/redact-image")
AI_COMPARISON_URL = config("AI_COMPARISON_URL", default="http://127.0.0.1:8011/api/compare-candidates")
AI_REQUEST_TIMEOUT_SECONDS = config("AI_REQUEST_TIMEOUT_SECONDS", default=45, cast=int)

# ─── Cloudinary ───────────────────────────────────────────────────────────────

CLOUDINARY_CLOUD_NAME   = config("CLOUDINARY_CLOUD_NAME", default="")
CLOUDINARY_API_KEY      = config("CLOUDINARY_API_KEY", default="")
CLOUDINARY_API_SECRET   = config("CLOUDINARY_API_SECRET", default="")
AI_MATCH_THRESHOLD = config("AI_MATCH_THRESHOLD", default=62, cast=int)  # high-precision recommendations only
AI_VISUAL_MATCH_THRESHOLD = config("AI_VISUAL_MATCH_THRESHOLD", default=55, cast=int)  # pre text/category bonus floor
AI_REDACTION_TIMEOUT_SECONDS = config("AI_REDACTION_TIMEOUT_SECONDS", default=10, cast=int)
AI_COMPARISON_TIMEOUT_SECONDS = config("AI_COMPARISON_TIMEOUT_SECONDS", default=8, cast=int)
AI_SERVICE_HEALTH_TIMEOUT_SECONDS = config("AI_SERVICE_HEALTH_TIMEOUT_SECONDS", default=1, cast=float)
AI_MAX_CANDIDATE_REPORTS = config("AI_MAX_CANDIDATE_REPORTS", default=30, cast=int)
