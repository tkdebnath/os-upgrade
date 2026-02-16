from pathlib import Path
import os

# LDAP Configuration
LDAP_ENABLED = os.getenv("LDAP_SERVER_URI", "").strip() != ""

if LDAP_ENABLED:
    import ldap
    from django_auth_ldap.config import (
        LDAPSearch,
        ActiveDirectoryGroupType,
        GroupOfNamesType,
    )

    # LDAP Server
    AUTH_LDAP_SERVER_URI = os.getenv("LDAP_SERVER_URI")
    AUTH_LDAP_BIND_DN = os.getenv("LDAP_BIND_DN", "")
    AUTH_LDAP_BIND_PASSWORD = os.getenv("LDAP_BIND_PASSWORD", "")

    # User Search
    user_search_base = os.getenv("LDAP_USER_SEARCH_BASE", "ou=users,dc=example,dc=com")
    user_search_filter = os.getenv("LDAP_USER_SEARCH_FILTER", "(uid=%(user)s)")
    AUTH_LDAP_USER_SEARCH = LDAPSearch(
        user_search_base, ldap.SCOPE_SUBTREE, user_search_filter
    )

    # Group Search (if configured)
    group_search_base = os.getenv("LDAP_GROUP_SEARCH_BASE", "")
    if group_search_base:
        AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
            group_search_base, ldap.SCOPE_SUBTREE, "(objectClass=*)"
        )

        # Group Type
        group_type = os.getenv("LDAP_GROUP_TYPE", "GroupOfNamesType")
        if group_type == "ActiveDirectoryGroupType":
            AUTH_LDAP_GROUP_TYPE = ActiveDirectoryGroupType()
        else:
            AUTH_LDAP_GROUP_TYPE = GroupOfNamesType()

        # Mirror LDAP groups to Django
        mirror_groups = os.getenv("LDAP_MIRROR_GROUPS", "False").lower() == "true"
        mirror_only_permission_groups = (
            os.getenv("LDAP_MIRROR_ONLY_PERMISSION_GROUPS", "True").lower() == "true"
        )

        if mirror_only_permission_groups and not mirror_groups:
            # Create Django groups for permission groups but don't sync all user's AD groups
            # This ensures the permission groups exist in Django without syncing everything
            AUTH_LDAP_MIRROR_GROUPS = False
            AUTH_LDAP_FIND_GROUP_PERMS = True

            # Store permission group names for signal handler
            permission_group_names = []

            if os.getenv("LDAP_GROUP_STAFF"):
                # Extract CN from DN (e.g., "cn=NetboxReadWriteAccess,ou=..." -> "NetboxReadWriteAccess")
                staff_dn = os.getenv("LDAP_GROUP_STAFF")
                staff_name = (
                    staff_dn.split(",")[0].replace("cn=", "").replace("CN=", "")
                )
                permission_group_names.append(staff_name)

            if os.getenv("LDAP_GROUP_SUPERUSER"):
                superuser_dn = os.getenv("LDAP_GROUP_SUPERUSER")
                superuser_name = (
                    superuser_dn.split(",")[0].replace("cn=", "").replace("CN=", "")
                )
                permission_group_names.append(superuser_name)

            if os.getenv("LDAP_GROUP_ACTIVE"):
                active_dn = os.getenv("LDAP_GROUP_ACTIVE")
                active_name = (
                    active_dn.split(",")[0].replace("cn=", "").replace("CN=", "")
                )
                permission_group_names.append(active_name)

            if os.getenv("LDAP_REQUIRE_GROUP"):
                require_dn = os.getenv("LDAP_REQUIRE_GROUP")
                require_name = (
                    require_dn.split(",")[0].replace("cn=", "").replace("CN=", "")
                )
                permission_group_names.append(require_name)

            # Store for later use in signal handler (don't import Group here - apps not ready yet)
            LDAP_PERMISSION_GROUP_NAMES = list(set(permission_group_names))
        else:
            # Mirror all groups or none based on LDAP_MIRROR_GROUPS setting
            AUTH_LDAP_MIRROR_GROUPS = mirror_groups

    # User Attribute Mapping
    AUTH_LDAP_USER_ATTR_MAP = {
        "first_name": os.getenv("LDAP_ATTR_FIRST_NAME", "givenName"),
        "last_name": os.getenv("LDAP_ATTR_LAST_NAME", "sn"),
        "email": os.getenv("LDAP_ATTR_EMAIL", "mail"),
    }

    # User Flags by Group (is_staff, is_superuser, is_active)
    AUTH_LDAP_USER_FLAGS_BY_GROUP = {}

    if os.getenv("LDAP_GROUP_STAFF"):
        AUTH_LDAP_USER_FLAGS_BY_GROUP["is_staff"] = os.getenv("LDAP_GROUP_STAFF")

    if os.getenv("LDAP_GROUP_SUPERUSER"):
        AUTH_LDAP_USER_FLAGS_BY_GROUP["is_superuser"] = os.getenv(
            "LDAP_GROUP_SUPERUSER"
        )

    if os.getenv("LDAP_GROUP_ACTIVE"):
        AUTH_LDAP_USER_FLAGS_BY_GROUP["is_active"] = os.getenv("LDAP_GROUP_ACTIVE")

    # Require group membership for access
    if os.getenv("LDAP_REQUIRE_GROUP"):
        AUTH_LDAP_REQUIRE_GROUP = os.getenv("LDAP_REQUIRE_GROUP")

    # Connection options
    AUTH_LDAP_CONNECTION_OPTIONS = {
        ldap.OPT_REFERRALS: 0,
    }

    if os.getenv("LDAP_DEBUG", "False").lower() == "true":
        AUTH_LDAP_CONNECTION_OPTIONS[ldap.OPT_DEBUG_LEVEL] = 1

    # Start TLS
    if os.getenv("LDAP_START_TLS", "False").lower() == "true":
        AUTH_LDAP_START_TLS = True

    # Always update user on login
    AUTH_LDAP_ALWAYS_UPDATE_USER = True

    # Auto-create users
    if os.getenv("LDAP_AUTO_CREATE_USERS", "True").lower() == "true":
        AUTH_LDAP_USER_FLAGS_BY_GROUP.setdefault("is_active", True)

    # Cache settings
    AUTH_LDAP_CACHE_TIMEOUT = 3600  # 1 hour

    # Authentication backends - LDAP first, then Django database
    AUTHENTICATION_BACKENDS = [
        "django_auth_ldap.backend.LDAPBackend",
        "django.contrib.auth.backends.ModelBackend",
    ]
else:
    # No LDAP - use Django database authentication only
    AUTHENTICATION_BACKENDS = [
        "django.contrib.auth.backends.ModelBackend",
    ]

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
SECRET_KEY = os.getenv("SECRET_KEY", "")

DEBUG = os.getenv("DEBUG", "False").lower() in ("true", "1", "yes")

# Parse ALLOWED_HOSTS from environment variable
allowed_hosts_env = os.getenv("ALLOWED_HOSTS", "localhost,127.0.0.1")
ALLOWED_HOSTS = [host.strip() for host in allowed_hosts_env.split(",")]

# Application definition

INSTALLED_APPS = [
    # Unfold (Tailwind Admin Theme) - Must be before django.contrib.admin
    "unfold",
    "unfold.contrib.filters",
    "unfold.contrib.forms",
    "unfold.contrib.inlines",
    "unfold.contrib.import_export",
    "unfold.contrib.guardian",
    "unfold.contrib.simple_history",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third party
    "rest_framework",
    "rest_framework_api_key",
    "drf_spectacular",
    "corsheaders",
    "django_extensions",
    "django_filters",
    # Local
    "swim_backend.core",
    "swim_backend.devices",
    "swim_backend.images",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "swim_backend.core.activity_logger.ActivityLoggerMiddleware",
]

ROOT_URLCONF = "swim_backend.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "swim_backend" / "templates"],
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

WSGI_APPLICATION = "swim_backend.wsgi.application"

# Database
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# Override with DATABASE_URL if provided (for PostgreSQL in production)
DATABASE_URL = os.getenv("DATABASE_URL", None)
if not DATABASE_URL:
    DB_NAME = os.getenv("POSTGRES_DB", "swimdb")
    DB_USER = os.getenv("POSTGRES_USER", "swimuser")
    DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "swimpass")
    DB_HOST = os.getenv("DB_HOST", "db")
    DB_PORT = os.getenv("DB_PORT", "5432")
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

if DATABASE_URL.startswith("postgresql://"):
    import re

    # Parse postgresql://user:password@host:port/dbname
    match = re.match(r"postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/(.+)", DATABASE_URL)
    if match:
        DATABASES = {
            "default": {
                "ENGINE": "django.db.backends.postgresql",
                "NAME": match.group(5),
                "USER": match.group(1),
                "PASSWORD": match.group(2),
                "HOST": match.group(3),
                "PORT": match.group(4),
            }
        }

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

# Internationalization
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "static"

# WhiteNoise configuration for serving static files
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

# Default primary key field type
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# CORS
# CORS settings - allow credentials for session auth
# Allow all origins in development (wildcard * in ALLOWED_HOSTS)
# In production, configure specific origins
if "*" in ALLOWED_HOSTS:
    CORS_ALLOW_ALL_ORIGINS = True
else:
    CORS_ALLOW_ALL_ORIGINS = False
    CORS_ALLOWED_ORIGINS = [
        "http://localhost",
        "https://localhost",
        "http://127.0.0.1",
        "https://127.0.0.1",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
CORS_ALLOW_CREDENTIALS = True

# CSRF settings for cross-origin requests
# Build CSRF_TRUSTED_ORIGINS from ALLOWED_HOSTS
CSRF_TRUSTED_ORIGINS = []
for host in ALLOWED_HOSTS:
    if host and host != "*":
        # Add both http and https for each host
        if not host.startswith("http"):
            CSRF_TRUSTED_ORIGINS.append(f"http://{host}")
            CSRF_TRUSTED_ORIGINS.append(f"https://{host}")
        else:
            CSRF_TRUSTED_ORIGINS.append(host)

# Always include common development origins
CSRF_TRUSTED_ORIGINS.extend(
    [
        "http://localhost",
        "https://localhost",
        "http://127.0.0.1",
        "https://127.0.0.1",
        "http://localhost:80",
        "https://localhost:443",
        "http://127.0.0.1:80",
        "https://127.0.0.1:443",
    ]
)

# Remove duplicates
CSRF_TRUSTED_ORIGINS = list(set(CSRF_TRUSTED_ORIGINS))

CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript to read CSRF token
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_HTTPONLY = True

# REST Framework
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 100,
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "swim_backend.authentication.APIKeyAuthentication",
        "swim_backend.authentication.CsrfExemptSessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "swim_backend.core.permissions.DjangoModelPermissionsWithView",
    ],
    # Disable CSRF for API endpoints when using SessionAuthentication
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    # Explicitly disable django-filters to prevent 'model' field error
    "DEFAULT_FILTER_BACKENDS": [],
}

# Spectacular (Swagger) Settings
SPECTACULAR_SETTINGS = {
    "TITLE": "SWIM API",
    "DESCRIPTION": "Software Image Management API - NetBox-style endpoints for managing network devices, software images, and upgrade workflows",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "SCHEMA_PATH_PREFIX": r"/api/",
    "COMPONENT_SPLIT_REQUEST": True,
    "SWAGGER_UI_SETTINGS": {
        "deepLinking": True,
        "persistAuthorization": True,
        "displayOperationId": True,
    },
    "AUTHENTICATION_WHITELIST": [],
    "APPEND_COMPONENTS": {
        "securitySchemes": {
            "ApiKeyAuth": {
                "type": "apiKey",
                "in": "header",
                "name": "Authorization",
                "description": "API Key authentication. Use format: Token YOUR_TOKEN_HERE",
            },
            "SessionAuth": {
                "type": "apiKey",
                "in": "cookie",
                "name": "sessionid",
                "description": "Django session authentication (login via /admin/)",
            },
        }
    },
    "SECURITY": [
        {"ApiKeyAuth": []},
        {"SessionAuth": []},
    ],
    # Disable problematic extensions
    "DISABLE_ERRORS_AND_WARNINGS": False,
    "PREPROCESSING_HOOKS": [],
    "POSTPROCESSING_HOOKS": [],
    # Explicitly disable django-filters extension to prevent 'model' field error
    "SCHEMA_COERCE_METHOD_NAMES": {},
}

# LDAP Configuration
# import ldap
# from django_auth_ldap.config import LDAPSearch
# AUTH_LDAP_SERVER_URI = "ldap://ldap.example.com"
# ... set AUTHENTICATION_BACKENDS to include 'django_auth_ldap.backend.LDAPBackend'

# Logging Configuration
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "verbose": {
            "format": "{levelname} {asctime} {module} {message}",
            "style": "{",
        },
    },
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "verbose",
        },
    },
    "loggers": {
        "django_auth_ldap": {
            "handlers": ["console"],
            "level": "DEBUG"
            if os.getenv("LDAP_DEBUG", "False").lower() == "true"
            else "INFO",
        },
        "swim_backend.core.auth_views": {
            "handlers": ["console"],
            "level": "INFO",
        },
        "swim_backend.ldap_signals": {
            "handlers": ["console"],
            "level": "INFO",
        },
    },
}

from .unfold_settings import UNFOLD

# ============================================================================
# SWIM - Device Model Restrictions
# ============================================================================
# Supported Device Models - loaded from file
# Format: One model per line - lines starting with # are comments
# File path: env/supported_models.env (relative to project root)
_DEFAULT_SUPPORTED_MODELS = [
    "Catalyst 9200",
    "Catalyst 9300",
    "Catalyst 9400",
    "Catalyst 9500",
    "Catalyst 9600",
    "C9200",
    "C9300",
    "C9400",
    "C9500",
    "C9600",
    "Nexus 3000",
    "Nexus 5000",
    "Nexus 7000",
    "Nexus 9000",
    "N3K",
    "N5K",
    "N7K",
    "N9K",
    "ASR1000",
    "ASR9000",
]


def _load_supported_models_from_file():
    """Load supported models from env/supported_models.env file.

    File format:
    - One model per line
    - Lines starting with # are comments
    - Empty lines are ignored

    Returns list of models or None if file not found.
    """
    import os

    # Try multiple possible paths
    possible_paths = [
        os.path.join(BASE_DIR, "env", "supported_models.env"),
        os.path.join(BASE_DIR, "..", "env", "supported_models.env"),
        "/app/env/supported_models.env",
    ]

    for file_path in possible_paths:
        if os.path.exists(file_path):
            try:
                with open(file_path, "r") as f:
                    content = f.read()

                models = []
                for line in content.split("\n"):
                    line = line.strip()
                    # Skip empty lines and comments
                    if line and not line.startswith("#"):
                        models.append(line)

                if models:
                    return models
            except Exception:
                pass

    return None


def _parse_supported_models(env_value):
    """Parse supported models from environment variable or file.

    Supports:
    - File: env/supported_models.env (one per line, # comments)
    - Env var: Comma-separated or newline-separated
    - Fallback: Default list
    """
    # First try to load from file
    file_models = _load_supported_models_from_file()
    if file_models:
        return file_models

    # Then try environment variable
    if not env_value:
        return _DEFAULT_SUPPORTED_MODELS

    models = []
    # First try comma-separated, then newline-separated
    if "," in env_value:
        parts = env_value.split(",")
    else:
        parts = env_value.split("\n")

    for part in parts:
        part = part.strip()
        # Skip empty lines and comments
        if part and not part.startswith("#"):
            models.append(part)

    return models if models else _DEFAULT_SUPPORTED_MODELS


SUPPORTED_DEVICE_MODELS = _parse_supported_models(os.getenv("SUPPORTED_DEVICE_MODELS"))
