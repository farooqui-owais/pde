# models_pde.py
"""SQLAlchemy models for the iSarita Public Data Entry (PDE) module.
These are additive to the existing models and do not modify login/registration logic.
"""

import enum
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
    Enum,
    JSON,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class PDESessionStatus(str, enum.Enum):
    OPEN = "OPEN"
    SUBMITTED = "SUBMITTED"
    CANCELLED = "CANCELLED"


class PDENetworkToken(Base):
    """Token used for "Data entry without login" flow.
    Stores a generated 11‑digit token number and a hashed password.
    """

    __tablename__ = "pde_tokens"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_number = Column(String(30), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(Enum(PDESessionStatus), default=PDESessionStatus.OPEN)

    # Relationships to the step data – one‑to‑one with Presentation
    presentation = relationship("PDEStepPresentation", back_populates="token", uselist=False)
    properties = relationship("PDEStepProperty", back_populates="token")
    parties = relationship("PDEStepParty", back_populates="token")
    identifications = relationship("PDEStepIdentification", back_populates="token")
    stamp_payments = relationship("PDEStepStampPayment", back_populates="token")


class PDEStepPresentation(Base):
    __tablename__ = "pde_presentation"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_id = Column(UUID(as_uuid=False), ForeignKey("pde_tokens.id"), nullable=False, unique=True)
    article = Column(String(100), nullable=False)
    document_title = Column(String(150), nullable=False)
    execution_date = Column(DateTime, nullable=False)
    presentation_date = Column(DateTime, default=datetime.utcnow)
    market_value = Column(Numeric(14, 2), nullable=True)
    consideration = Column(Numeric(14, 2), nullable=True)
    stamp_duty = Column(Numeric(14, 2), nullable=True)
    stamp_duty_paid = Column(Numeric(14, 2), nullable=True)
    stamp_duty_difference = Column(Numeric(14, 2), nullable=True)
    page_count = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    token = relationship("PDENetworkToken", back_populates="presentation")


class PDEStepProperty(Base):
    __tablename__ = "pde_property"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_id = Column(UUID(as_uuid=False), ForeignKey("pde_tokens.id"), nullable=False)
    district = Column(String(120), nullable=False)
    village = Column(String(120), nullable=False)
    urban_rural = Column(String(20), nullable=False)
    hadd_type = Column(String(80), nullable=False)
    hadd_name = Column(String(120), nullable=False)
    taluka = Column(String(120), nullable=False)
    zp = Column(String(120), nullable=True)  # Zilla Parishad – optional for Rural
    attributes = Column(JSON, nullable=True)  # e.g. {"SurveyNumber": "123", "CTSN": "456"}
    area = Column(Numeric(14, 2), nullable=True)
    area_unit = Column(String(20), nullable=True)
    property_type = Column(String(80), nullable=False)
    pui_number = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    token = relationship("PDENetworkToken", back_populates="properties")


class PDEStepParty(Base):
    __tablename__ = "pde_party"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_id = Column(UUID(as_uuid=False), ForeignKey("pde_tokens.id"), nullable=False)
    party_type = Column(String(80), nullable=False)
    name_en = Column(String(150), nullable=False)
    name_mr = Column(String(150), nullable=False)
    age = Column(Integer, nullable=True)
    is_bank = Column(Boolean, default=False)
    is_stamp_purchaser = Column(Boolean, default=False)
    is_presentor = Column(Boolean, default=False)
    address = Column(JSON, nullable=True)  # {"flat":..., "road":...}
    pin_code = Column(String(10), nullable=True)
    mobile = Column(String(15), nullable=True)
    email = Column(String(120), nullable=True)
    pan = Column(String(15), nullable=True)
    uid = Column(String(12), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    token = relationship("PDENetworkToken", back_populates="parties")


class PDEStepIdentification(Base):
    __tablename__ = "pde_identification"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_id = Column(UUID(as_uuid=False), ForeignKey("pde_tokens.id"), nullable=False)
    id_type = Column(String(80), nullable=False)
    name_en = Column(String(150), nullable=False)
    name_mr = Column(String(150), nullable=False)
    age = Column(Integer, nullable=True)
    address = Column(JSON, nullable=True)
    proof_number = Column(String(80), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    token = relationship("PDENetworkToken", back_populates="identifications")


class PDEStepStampPayment(Base):
    __tablename__ = "pde_stamp_payment"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_id = Column(UUID(as_uuid=False), ForeignKey("pde_tokens.id"), nullable=False)
    paid_by = Column(String(30), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)
    franking_mc_no = Column(String(40), nullable=True)
    franking_serial_no = Column(String(60), nullable=True)
    vendor_name = Column(String(150), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    token = relationship("PDENetworkToken", back_populates="stamp_payments")
