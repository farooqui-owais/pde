"""models_verification.py

Additive SQLAlchemy models for the workflow tail-end steps that the
documentation pack (11_CURRENT_CODEBASE_MAP.md) assumed already existed
but were not present in the supplied codebase:

    - execution_captures
    - ekyc_verifications
    - sign_agreements
    - valuation_rates (master/config data referenced by 03_DATABASE_DESIGN.md)

These do NOT touch models.py / models_pde.py / models_scheme.py and do not
change login/registration/PDE/scheme behavior. They hang off the existing
`document_entries` table (models.DocumentEntry), which is the same
central PDE entity the rest of app/routers/entry_details.py, stamp.py and
documents.py already key off of.

Security note (per 03_DATABASE_DESIGN.md "Security requirement" and the
project's own "no sensitive identity values in logs" rule): this module
intentionally does NOT persist raw Aadhaar numbers or unmasked biometric
payloads. Only a masked reference and a provider-assigned verification
reference id are stored. Wiring to a real eKYC/e-sign provider, and the
exact retention policy for captured biometrics, is TBD — confirm from the
business owner before going to production.
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    String,
    Integer,
    DateTime,
    ForeignKey,
    Numeric,
    Boolean,
    Text,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class ExecutionCapture(Base):
    """Execution-capture event (photo / fingerprint / signature-pad capture
    taken at the SRO counter during document execution).

    `capture_type` and the exact device-integration payload are TBD — the
    supplied manual does not describe execution capture at all; this table
    exists only because 11_CURRENT_CODEBASE_MAP.md lists an
    `execution_captures` endpoint/model as already present. Kept generic
    and isolated behind this module until authoritative device/vendor
    requirements are supplied.
    """

    __tablename__ = "execution_captures"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_entry_id = Column(UUID(as_uuid=False), ForeignKey("document_entries.id"), nullable=False, index=True)
    party_id = Column(UUID(as_uuid=False), ForeignKey("party_details.id"), nullable=True)

    capture_type = Column(String(30), nullable=False)  # PHOTO / FINGERPRINT / SIGNATURE_PAD — TBD exact set
    storage_key = Column(Text, nullable=True)  # object-store path; never a raw binary column
    device_reference = Column(String(120), nullable=True)  # TBD: vendor/device correlation id
    status = Column(String(20), default="CAPTURED")  # CAPTURED / RETAKEN / REJECTED
    captured_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)
    captured_at = Column(DateTime, default=datetime.utcnow)
    extra_metadata = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document_entry = relationship("DocumentEntry")
    party = relationship("PartyDetail")


class EkycVerification(Base):
    """eKYC verification state for a party on a document entry.

    Only a masked identifier and the provider's verification reference are
    stored — never a raw Aadhaar/UID number or biometric template. Provider
    integration (UIDAI, DigiLocker, etc.) is TBD; `provider` and
    `verification_type` are kept as free-form strings until an authoritative
    integration is chosen.
    """

    __tablename__ = "ekyc_verifications"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_entry_id = Column(UUID(as_uuid=False), ForeignKey("document_entries.id"), nullable=False, index=True)
    party_id = Column(UUID(as_uuid=False), ForeignKey("party_details.id"), nullable=True)

    provider = Column(String(60), nullable=True)  # TBD — no provider confirmed by source
    verification_type = Column(String(30), nullable=True)  # e.g. OTP / BIOMETRIC — TBD
    masked_identifier = Column(String(20), nullable=True)  # e.g. "XXXXXXXX1234"; never the full number
    reference_id = Column(String(120), nullable=True, index=True)  # provider-issued reference/txn id
    status = Column(String(20), default="PENDING")  # PENDING / VERIFIED / FAILED / EXPIRED
    verified_at = Column(DateTime, nullable=True)
    provider_response_summary = Column(JSON, nullable=True)  # non-sensitive summary only

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document_entry = relationship("DocumentEntry")
    party = relationship("PartyDetail")


class SignAgreement(Base):
    """Agreement-signing state for a party on a document entry.

    Signing method (e-sign / wet-ink upload / Aadhaar-based e-sign) is TBD;
    the manual does not describe this step. Kept generic and additive.
    """

    __tablename__ = "sign_agreements"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_entry_id = Column(UUID(as_uuid=False), ForeignKey("document_entries.id"), nullable=False, index=True)
    party_id = Column(UUID(as_uuid=False), ForeignKey("party_details.id"), nullable=True)

    method = Column(String(30), nullable=True)  # TBD — e.g. ESIGN / WET_INK_UPLOAD
    status = Column(String(20), default="PENDING")  # PENDING / SIGNED / DECLINED
    signed_at = Column(DateTime, nullable=True)
    signature_storage_key = Column(Text, nullable=True)  # object-store path to signed artifact
    ip_address = Column(String(64), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document_entry = relationship("DocumentEntry")
    party = relationship("PartyDetail")


class ValuationRate(Base):
    """Location-based valuation-rate master/config data.

    Matches 03_DATABASE_DESIGN.md's `valuation_rates` table exactly. This is
    reference/config data (like districts/registration_offices), not a
    per-user record — populate it from the authoritative Ready Reckoner
    dataset; the exact source feed is TBD.
    """

    __tablename__ = "valuation_rates"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    state = Column(String(100), nullable=True, default="Maharashtra")
    district = Column(String(120), nullable=True, index=True)
    taluka = Column(String(120), nullable=True)
    village = Column(String(150), nullable=True)
    rate_per_sqft = Column(Numeric(18, 2), nullable=True)
    rate_per_sqm = Column(Numeric(18, 2), nullable=True)
    rate_per_acre = Column(Numeric(18, 2), nullable=True)
    effective_from = Column(DateTime, nullable=True)
    effective_to = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
