"""Central, env-driven settings for the PDE backend.

Keeping one get_settings() source means CSRF, security headers, CORS, trusted
hosts, and DEBUG gating all read from the same place (and from .env.example).
"""
import os
from functools import lru_cache

from dotenv import load_dotenv

load_dotenv()


def _truthy(value: str) -> bool:
    return value.strip().lower() in ("1", "true", "yes", "on")


def _csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@lru_cache
def get_settings() -> dict:
    return {
        "APP_NAME": os.getenv("APP_NAME", "PDE API"),
        "APP_VERSION": os.getenv("APP_VERSION", "1.0.0"),
        "DEBUG": _truthy(os.getenv("DEBUG", "False")),
        "SECRET_KEY": os.getenv(
            "SECRET_KEY", "change-this-secret-key-in-production-please-32chars"
        ),
        "ALGORITHM": os.getenv("ALGORITHM", "HS256"),
        "ACCESS_TOKEN_EXPIRE_MINUTES": int(
            os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "120")
        ),
        "CORS_ORIGINS": _csv(
            os.getenv(
                "CORS_ORIGINS",
                "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173",
            )
        ),
        "CSRF_COOKIE_SECURE": _truthy(os.getenv("CSRF_COOKIE_SECURE", "False")),
        "CSRF_COOKIE_SAMESITE": os.getenv("CSRF_COOKIE_SAMESITE", "lax"),
        "CSRF_COOKIE_NAME": os.getenv("CSRF_COOKIE_NAME", "csrf_token"),
        "CSRF_HEADER_NAME": os.getenv("CSRF_HEADER_NAME", "X-CSRF-Token"),
        "TRUSTED_HOSTS": _csv(os.getenv("TRUSTED_HOSTS", "*")),
        # Rate limiting (auth endpoints), per IP.
        "RATE_LIMIT_MAX": int(os.getenv("RATE_LIMIT_MAX", "8")),
        "RATE_LIMIT_WINDOW_SECONDS": int(
            os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60")
        ),
    }


