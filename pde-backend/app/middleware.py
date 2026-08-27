"""Security middleware for the PDE backend.

Three concerns live here (kept as small standalone classes so they can be
cherry-picked in main.py):
  1. SecurityHeadersMiddleware  - additive response security headers (§2/§6).
  2. CSRFProtectMiddleware      - double-submit cookie CSRF check (§2).
"""
from __future__ import annotations

import secrets
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}

# Headers prescribed by REUSABLE_PROJECT_PROMPT.md §2.
SECURITY_HEADERS = {
    "X-Frame-Options": "SAMEORIGIN",
    "X-Content-Type-Options": "nosniff",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'self'; frame-ancestors 'self'",
}

# The interactive API docs (Swagger UI at /docs, ReDoc at /redoc, and the raw
# /openapi.json schema) are only mounted when DEBUG=True, and they load their
# UI assets from the jsdelivr CDN plus an inline bootstrap <script>. The strict
# `default-src 'self'` policy above would block all of those, rendering /docs
# as a blank white page. So those DEBUG-only doc routes get a deliberately
# wider CSP (swagger downloads CSS/JS from cdn.jsdelivr.net, uses inline
# scripts, and SwaggerUIBundle needs 'unsafe-eval'); every other path keeps
# the strict policy.
DOCS_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; "
    "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    "img-src 'self' data: https://fastapi.tiangolo.com; "
    "connect-src 'self'; frame-ancestors 'self'; base-uri 'self'"
)
DOCS_ROUTE_PREFIXES = ("/docs", "/redoc", "/openapi.json")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        headers = dict(SECURITY_HEADERS)
        if request.url.path.startswith(DOCS_ROUTE_PREFIXES):
            headers["Content-Security-Policy"] = DOCS_CSP
        for name, value in headers.items():
            response.headers.setdefault(name, value)
        return response


class CSRFProtectMiddleware(BaseHTTPMiddleware):
    """Double-submit cookie protection for every non-safe method.

    The browser sends the `csrf_token` cookie; the client must echo the same
    value back in the `X-CSRF-Token` header. A mismatch / missing pair =>
    403 with detail "CSRF validation failed" (the Reusable prompt's wording).
    """

    def __init__(
        self,
        app,
        cookie_name: str = "csrf_token",
        header_name: str = "X-CSRF-Token",
        exempt_paths: Optional[set[str]] = None,
    ):
        super().__init__(app)
        self.cookie_name = cookie_name
        self.header_name = header_name
        self.exempt_paths = exempt_paths or {
            "/api/auth/csrf-token",
            "/api/health",
        }

    async def dispatch(self, request: Request, call_next):
        if request.method not in SAFE_METHODS and request.url.path not in self.exempt_paths:
            cookie = request.cookies.get(self.cookie_name)
            header = request.headers.get(self.header_name)
            if not cookie or not header or not secrets.compare_digest(cookie, header):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF validation failed"},
                )
        return await call_next(request)