import time

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .config import get_settings
from .database import Base, engine
from .middleware import CSRFProtectMiddleware, SecurityHeadersMiddleware
from . import models, models_pde, models_scheme, models_verification
from .routers import (
    auth, tokens, documents, reference, stamp, pde, entry_details,
    projects, schemes, seller_parties, scheme_identifier, scheme_documents, templates,
    execution_captures, ekyc_verifications, sign_agreements, valuation_rates, slots,
    digital_submission,
)
from .seed import run as seed_reference_data

settings = get_settings()


def _ensure_additive_columns():
    """Add columns introduced after the first create_all on existing databases."""
    statements = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_guest BOOLEAN DEFAULT FALSE",
        "ALTER TABLE entry_tokens ADD COLUMN IF NOT EXISTS access_password_hash VARCHAR(255)",
        "ALTER TABLE entry_tokens ADD COLUMN IF NOT EXISTS slot_booking_id VARCHAR(36)",
        # Gap 3: Property Details missing columns
        "ALTER TABLE property_details ADD COLUMN IF NOT EXISTS eother_desc TEXT",
        "ALTER TABLE property_details ADD COLUMN IF NOT EXISTS potkharaba_area NUMERIC(14,2) DEFAULT 0.0",
        "ALTER TABLE property_details ADD COLUMN IF NOT EXISTS other_right_mr VARCHAR(200)",
        "ALTER TABLE property_details ADD COLUMN IF NOT EXISTS other_right_en VARCHAR(200)",
        # Gap 2: Party Details missing columns
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS party_sr_no INTEGER",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS alias_name_mr VARCHAR(150)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS alias_name_en VARCHAR(150)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS id_type VARCHAR(20)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS id_no VARCHAR(40)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS full_pan_name VARCHAR(200)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS survey_no VARCHAR(60)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS khata_no VARCHAR(60)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS party_area NUMERIC(14,2)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS vikri_area NUMERIC(14,2)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS potkharaba_area NUMERIC(14,2)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS potkharaba_vikri_area NUMERIC(14,2)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS seller_khata_no VARCHAR(60)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS seller_first_name VARCHAR(80)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS seller_middle_name VARCHAR(80)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS seller_last_name VARCHAR(80)",
        "ALTER TABLE party_details ADD COLUMN IF NOT EXISTS mobile_number_verified BOOLEAN DEFAULT FALSE",
        # Presentation Details ("Token Details") view — screenshots: /frmTokenDetails
        "ALTER TABLE article_types ADD COLUMN IF NOT EXISTS description VARCHAR(255)",
        "ALTER TABLE document_entries ADD COLUMN IF NOT EXISTS presenter_type VARCHAR(60)",
        "ALTER TABLE document_entries ADD COLUMN IF NOT EXISTS valuation_text VARCHAR(255)",
        "ALTER TABLE document_entries ADD COLUMN IF NOT EXISTS no_valuation_reason TEXT",
        "ALTER TABLE document_entries ADD COLUMN IF NOT EXISTS document_executed_in VARCHAR(60) DEFAULT 'India'",
        "ALTER TABLE registration_offices ADD COLUMN IF NOT EXISTS dig_name VARCHAR(150)",
        "ALTER TABLE registration_offices ADD COLUMN IF NOT EXISTS jdr_name VARCHAR(150)",
    ]
    dialect = engine.dialect.name
    with engine.begin() as conn:
        if dialect == "postgresql":
            for stmt in statements:
                conn.execute(text(stmt))
        elif dialect == "sqlite":
            def add_col_sqlite(table, col_name, col_def):
                cols = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
                if col_name not in cols:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}"))

            add_col_sqlite("users", "is_guest", "BOOLEAN DEFAULT 0")
            add_col_sqlite("entry_tokens", "access_password_hash", "VARCHAR(255)")
            add_col_sqlite("entry_tokens", "slot_booking_id", "VARCHAR(36)")
            # Gap 3
            add_col_sqlite("property_details", "eother_desc", "TEXT")
            add_col_sqlite("property_details", "potkharaba_area", "NUMERIC(14,2) DEFAULT 0.0")
            add_col_sqlite("property_details", "other_right_mr", "VARCHAR(200)")
            add_col_sqlite("property_details", "other_right_en", "VARCHAR(200)")
            # Gap 2
            add_col_sqlite("party_details", "party_sr_no", "INTEGER")
            add_col_sqlite("party_details", "alias_name_mr", "VARCHAR(150)")
            add_col_sqlite("party_details", "alias_name_en", "VARCHAR(150)")
            add_col_sqlite("party_details", "id_type", "VARCHAR(20)")
            add_col_sqlite("party_details", "id_no", "VARCHAR(40)")
            add_col_sqlite("party_details", "full_pan_name", "VARCHAR(200)")
            add_col_sqlite("party_details", "survey_no", "VARCHAR(60)")
            add_col_sqlite("party_details", "khata_no", "VARCHAR(60)")
            add_col_sqlite("party_details", "party_area", "NUMERIC(14,2)")
            add_col_sqlite("party_details", "vikri_area", "NUMERIC(14,2)")
            add_col_sqlite("party_details", "potkharaba_area", "NUMERIC(14,2)")
            add_col_sqlite("party_details", "potkharaba_vikri_area", "NUMERIC(14,2)")
            add_col_sqlite("party_details", "seller_khata_no", "VARCHAR(60)")
            add_col_sqlite("party_details", "seller_first_name", "VARCHAR(80)")
            add_col_sqlite("party_details", "seller_middle_name", "VARCHAR(80)")
            add_col_sqlite("party_details", "seller_last_name", "VARCHAR(80)")
            add_col_sqlite("party_details", "mobile_number_verified", "BOOLEAN DEFAULT 0")
            # Presentation Details ("Token Details") view
            add_col_sqlite("article_types", "description", "VARCHAR(255)")
            add_col_sqlite("document_entries", "presenter_type", "VARCHAR(60)")
            add_col_sqlite("document_entries", "valuation_text", "VARCHAR(255)")
            add_col_sqlite("document_entries", "no_valuation_reason", "TEXT")
            add_col_sqlite("document_entries", "document_executed_in", "VARCHAR(60) DEFAULT 'India'")
            add_col_sqlite("registration_offices", "dig_name", "VARCHAR(150)")
            add_col_sqlite("registration_offices", "jdr_name", "VARCHAR(150)")


def _init_db(max_attempts=15, retry_delay=1.0):
    """Create the schema and seed reference data once Postgres is reachable.

    The API container often starts before the DB pod finishes booting. The
    original one-shot ``create_all`` failed once, was swallowed by ``try/except``,
    and left the DB empty — every DB-backed endpoint then returned a 500. The
    browser blamed CORS because a 500 body bypasses CORSMiddleware (no
    Access-Control-Allow-Origin header). Retrying here lets a fresh deployment
    self-heal instead of silently serving broken queries.
    """
    last_exc = None
    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            Base.metadata.create_all(bind=engine)
            _ensure_additive_columns()
            seed_reference_data()
            print(f"[startup] Schema + reference data ready (attempt {attempt}).")
            return
        except Exception as exc:
            last_exc = exc
            print(f"[startup] DB init attempt {attempt}/{max_attempts} failed: {exc}")
            time.sleep(retry_delay)
    print(
        f"[startup] WARNING: DB init still failing after {max_attempts} attempts "
        f"({last_exc}). DB-backed endpoints will 500 until it succeeds."
    )


_init_db()


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
app.include_router(projects.router)
app.include_router(schemes.router)
app.include_router(seller_parties.router)
app.include_router(scheme_identifier.router)
app.include_router(scheme_documents.router)
app.include_router(templates.router)
app.include_router(execution_captures.router)
app.include_router(ekyc_verifications.router)
app.include_router(sign_agreements.router)
app.include_router(valuation_rates.router)
app.include_router(slots.router)
app.include_router(digital_submission.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "dakhalnama-api"}
