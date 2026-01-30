from pathlib import Path
import os

# LDAP Configuration
LDAP_ENABLED = os.getenv('LDAP_SERVER_URI', '').strip() != ''

if LDAP_ENABLED:
    import ldap
    from django_auth_ldap.config import LDAPSearch, ActiveDirectoryGroupType, GroupOfNamesType
    
    # LDAP Server
    AUTH_LDAP_SERVER_URI = os.getenv('LDAP_SERVER_URI')
    AUTH_LDAP_BIND_DN = os.getenv('LDAP_BIND_DN', '')
    AUTH_LDAP_BIND_PASSWORD = os.getenv('LDAP_BIND_PASSWORD', '')
    
    # User Search
    user_search_base = os.getenv('LDAP_USER_SEARCH_BASE', 'ou=users,dc=example,dc=com')
    user_search_filter = os.getenv('LDAP_USER_SEARCH_FILTER', '(uid=%(user)s)')
    AUTH_LDAP_USER_SEARCH = LDAPSearch(
        user_search_base,
        ldap.SCOPE_SUBTREE,
        user_search_filter
    )
    
    # Group Search (if configured)
    group_search_base = os.getenv('LDAP_GROUP_SEARCH_BASE', '')
    if group_search_base:
        AUTH_LDAP_GROUP_SEARCH = LDAPSearch(
            group_search_base,
            ldap.SCOPE_SUBTREE,
            "(objectClass=*)"
        )
        
        # Group Type
        group_type = os.getenv('LDAP_GROUP_TYPE', 'GroupOfNamesType')
        if group_type == 'ActiveDirectoryGroupType':
            AUTH_LDAP_GROUP_TYPE = ActiveDirectoryGroupType()
        else:
            AUTH_LDAP_GROUP_TYPE = GroupOfNamesType()
        
        # Mirror LDAP groups to Django
        AUTH_LDAP_MIRROR_GROUPS = os.getenv('LDAP_MIRROR_GROUPS', 'False').lower() == 'true'
    
    # User Attribute Mapping
    AUTH_LDAP_USER_ATTR_MAP = {
        "first_name": os.getenv('LDAP_ATTR_FIRST_NAME', 'givenName'),
        "last_name": os.getenv('LDAP_ATTR_LAST_NAME', 'sn'),
        "email": os.getenv('LDAP_ATTR_EMAIL', 'mail'),
    }
    
    # User Flags by Group (is_staff, is_superuser, is_active)
    AUTH_LDAP_USER_FLAGS_BY_GROUP = {}
    
    if os.getenv('LDAP_GROUP_STAFF'):
        AUTH_LDAP_USER_FLAGS_BY_GROUP['is_staff'] = os.getenv('LDAP_GROUP_STAFF')
    
    if os.getenv('LDAP_GROUP_SUPERUSER'):
        AUTH_LDAP_USER_FLAGS_BY_GROUP['is_superuser'] = os.getenv('LDAP_GROUP_SUPERUSER')
    
    if os.getenv('LDAP_GROUP_ACTIVE'):
        AUTH_LDAP_USER_FLAGS_BY_GROUP['is_active'] = os.getenv('LDAP_GROUP_ACTIVE')
    
    # Require group membership for access
    if os.getenv('LDAP_REQUIRE_GROUP'):
        AUTH_LDAP_REQUIRE_GROUP = os.getenv('LDAP_REQUIRE_GROUP')
    
    # Connection options
    AUTH_LDAP_CONNECTION_OPTIONS = {
        ldap.OPT_REFERRALS: 0,
    }
    
    if os.getenv('LDAP_DEBUG', 'False').lower() == 'true':
        AUTH_LDAP_CONNECTION_OPTIONS[ldap.OPT_DEBUG_LEVEL] = 1
    
    # Start TLS
    if os.getenv('LDAP_START_TLS', 'False').lower() == 'true':
        AUTH_LDAP_START_TLS = True
    
    # Always update user on login
    AUTH_LDAP_ALWAYS_UPDATE_USER = True
    
    # Auto-create users
    if os.getenv('LDAP_AUTO_CREATE_USERS', 'True').lower() == 'true':
        AUTH_LDAP_USER_FLAGS_BY_GROUP.setdefault('is_active', True)
    
    # Cache settings
    AUTH_LDAP_CACHE_TIMEOUT = 3600  # 1 hour
    
    # Authentication backends - LDAP first, then Django database
    AUTHENTICATION_BACKENDS = [
        'django_auth_ldap.backend.LDAPBackend',
        'django.contrib.auth.backends.ModelBackend',
    ]
else:
    # No LDAP - use Django database authentication only
    AUTHENTICATION_BACKENDS = [
        'django.contrib.auth.backends.ModelBackend',
    ]

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# Quick-start development settings - unsuitable for production
SECRET_KEY = 'django-insecure-change-me-in-production'

DEBUG = True

ALLOWED_HOSTS = []

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
    
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # Third party
    'rest_framework',
    'rest_framework_api_key',
    'drf_spectacular',
    'corsheaders',
    'django_extensions',
    'django_filters',
    
    # Local
    'swim_backend.core',
    'swim_backend.devices',
    'swim_backend.images',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'swim_backend.core.activity_logger.ActivityLoggerMiddleware',
]

ROOT_URLCONF = 'swim_backend.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'swim_backend' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'swim_backend.wsgi.application'

# Database
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}

# Password validation
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

# Internationalization
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'UTC'
USE_I18N = True
USE_TZ = True

# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'static'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'

# Default primary key field type
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# CORS
# CORS settings - allow credentials for session auth
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CORS_ALLOW_CREDENTIALS = True

# CSRF settings for cross-origin requests
CSRF_TRUSTED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False  # Allow JavaScript to read CSRF token
SESSION_COOKIE_SAMESITE = 'Lax'
SESSION_COOKIE_HTTPONLY = True

# REST Framework
REST_FRAMEWORK = {
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 100,
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'swim_backend.authentication.APIKeyAuthentication',
        'swim_backend.authentication.CsrfExemptSessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'swim_backend.core.permissions.DjangoModelPermissionsWithView',
    ],
    # Disable CSRF for API endpoints when using SessionAuthentication
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
        'rest_framework.renderers.BrowsableAPIRenderer',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# Spectacular (Swagger) Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'SWIM API',
    'DESCRIPTION': 'Software Image Management API - NetBox-style endpoints for managing network devices, software images, and upgrade workflows',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
    'SCHEMA_PATH_PREFIX': r'/api/',
    'COMPONENT_SPLIT_REQUEST': True,
    'SWAGGER_UI_SETTINGS': {
        'deepLinking': True,
        'persistAuthorization': True,
        'displayOperationId': True,
    },
    'AUTHENTICATION_WHITELIST': [],
    'APPEND_COMPONENTS': {
        'securitySchemes': {
            'ApiKeyAuth': {
                'type': 'apiKey',
                'in': 'header',
                'name': 'Authorization',
                'description': 'API Key authentication. Use format: Token YOUR_TOKEN_HERE'
            },
            'SessionAuth': {
                'type': 'apiKey',
                'in': 'cookie',
                'name': 'sessionid',
                'description': 'Django session authentication (login via /admin/)'
            }
        }
    },
    'SECURITY': [
        {'ApiKeyAuth': []},
        {'SessionAuth': []},
    ],
}

# LDAP Configuration
# import ldap
# from django_auth_ldap.config import LDAPSearch
# AUTH_LDAP_SERVER_URI = "ldap://ldap.example.com"
# ... set AUTHENTICATION_BACKENDS to include 'django_auth_ldap.backend.LDAPBackend'

from .unfold_settings import UNFOLD
