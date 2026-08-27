from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import get_settings
from .database import Base, engine
from .middleware import CSRFProtectMiddleware, SecurityHeadersMiddleware
from .routers import auth, tokens, documents, reference, stamp, pde, entry_details
from .seed import run as seed_reference_data

settings = get_settings()

Base.metadata.create_all(bind=engine)

# Auto-seed districts / offices / article types / document titles on every
# startup. seed.run() only inserts rows that don't already exist, so this
# is safe to call every time and means a fresh docker-compose / DB never
# ends up with empty Select Article / Document Title dropdowns.
try:
    seed_reference_data()
except Exception as exc:  # pragma: no cover - defensive, don't crash the API
    print(f"[startup] reference-data seed skipped: {exc}")

app = FastAPI(
    title=settings["APP_NAME"],
    version=settings["APP_VERSION"],
    # §2: disable Swagger/ReDoc and debug output when DEBUG=False (production).
    docs_url="/docs" if settings["DEBUG"] else None,
    redoc_url="/redoc" if settings["DEBUG"] else None,
    openapi_url="/openapi.json" if settings["DEBUG"] else None,
)

# Middleware ordering note: FastAPI runs the LAST-added middleware first, so we
# add CORS last to keep it outermost (it must see preflight OPTIONS before the
# CSRF check). CSRF + security headers wrap every request path.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CSRFProtectMiddleware,
    cookie_name=settings["CSRF_COOKIE_NAME"],
    header_name=settings["CSRF_HEADER_NAME"],
)
if settings["TRUSTED_HOSTS"] != ["*"]:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings["TRUSTED_HOSTS"])
app.add_middleware(
    CORSMiddleware,
    # §2: exact allowlist from env, never "*" when cookies are involved.
    allow_origins=settings["CORS_ORIGINS"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", settings["CSRF_HEADER_NAME"]],
)

app.include_router(auth.router)
app.include_router(tokens.router)
app.include_router(documents.router)
app.include_router(reference.router)
app.include_router(stamp.router)
app.include_router(pde.router)
app.include_router(entry_details.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "dakhalnama-api"}
