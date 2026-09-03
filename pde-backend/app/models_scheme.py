import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Numeric, Boolean, Text, JSON
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_name = Column(String(255), nullable=False)
    developed_by = Column(String(255), nullable=True)
    project_pan = Column(String(20), nullable=True)
    district = Column(String(100), nullable=True)
    taluka = Column(String(100), nullable=True)
    village = Column(String(100), nullable=True)
    corporation = Column(String(255), nullable=True)
    gat_number = Column(String(100), nullable=True)
    survey_number = Column(String(100), nullable=True)
    hissa_number = Column(String(100), nullable=True)
    location = Column(Text, nullable=True)
    sub_location = Column(Text, nullable=True)
    rate = Column(Numeric(18, 2), nullable=True)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User")
    schemes = relationship("Scheme", back_populates="project", cascade="all, delete-orphan")


class Scheme(Base):
    __tablename__ = "schemes"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    project_id = Column(UUID(as_uuid=False), ForeignKey("projects.id"), nullable=False)
    article = Column(String(255), nullable=True)
    document_title = Column(String(255), nullable=True)
    scheme_name = Column(String(255), nullable=False)
    draft_title = Column(String(255), nullable=True)
    maha_rera_number = Column(String(100), nullable=True)
    project_area = Column(Numeric(18, 4), nullable=True)
    project_area_unit = Column(String(50), default="sq.ft")
    rera_validation_date = Column(DateTime, nullable=True)
    rate = Column(Numeric(18, 2), nullable=True)
    valuation_rule = Column(String(255), nullable=True)
    scheme_number = Column(String(100), unique=True, nullable=True, index=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="draft", index=True)  # draft / submitted / approved / rejected
    jdr_remark = Column(Text, nullable=True)
    total_units = Column(Integer, nullable=True)
    total_area = Column(Numeric(18, 4), nullable=True)
    rate_per_sqft = Column(Numeric(18, 2), nullable=True)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    project = relationship("Project", back_populates="schemes")
    user = relationship("User")
    seller_parties = relationship("SellerParty", back_populates="scheme", cascade="all, delete-orphan")
    identifier = relationship("SchemeIdentifier", back_populates="scheme", uselist=False, cascade="all, delete-orphan")
    documents = relationship("SchemeDocument", back_populates="scheme", cascade="all, delete-orphan")
    templates = relationship("Template", back_populates="scheme", cascade="all, delete-orphan")


class SellerParty(Base):
    __tablename__ = "seller_parties"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    scheme_id = Column(UUID(as_uuid=False), ForeignKey("schemes.id"), nullable=False)
    party_category = Column(String(100), nullable=False)  # Company, Partnership, Individual, Power of Attorney, Community Base Organization, Licensor, Builder/Purchaser
    party_name = Column(String(255), nullable=False)
    pan_number = Column(String(20), nullable=True)
    aadhaar_number = Column(String(32), nullable=True)
    mobile_number = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    address_line1 = Column(Text, nullable=True)
    address_line2 = Column(Text, nullable=True)
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    taluka = Column(String(100), nullable=True)
    village = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    company_name = Column(String(255), nullable=True)
    registration_number = Column(String(100), nullable=True)
    poa_holder_name = Column(String(255), nullable=True)
    poa_document_number = Column(String(100), nullable=True)
    poa_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scheme = relationship("Scheme", back_populates="seller_parties")


class SchemeIdentifier(Base):
    __tablename__ = "scheme_identifiers"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    scheme_id = Column(UUID(as_uuid=False), ForeignKey("schemes.id"), nullable=False, unique=True)
    identifier_type = Column(String(100), nullable=True)
    name = Column(String(255), nullable=False)
    age = Column(Integer, nullable=True)
    gender = Column(String(20), nullable=True)
    mobile_number = Column(String(30), nullable=True)
    email = Column(String(255), nullable=True)
    pan_number = Column(String(20), nullable=True)
    aadhaar_number = Column(String(32), nullable=True)
    address = Column(Text, nullable=True)
    state = Column(String(100), nullable=True)
    district = Column(String(100), nullable=True)
    taluka = Column(String(100), nullable=True)
    village = Column(String(100), nullable=True)
    pincode = Column(String(20), nullable=True)
    occupation = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scheme = relationship("Scheme", back_populates="identifier")


class SchemeDocument(Base):
    __tablename__ = "scheme_documents"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    scheme_id = Column(UUID(as_uuid=False), ForeignKey("schemes.id"), nullable=False)
    document_type = Column(String(100), nullable=False)  # 7/12, RERA Certificate, Approved Layout, Title Certificate, POA, etc.
    document_name = Column(String(255), nullable=False)
    storage_key = Column(Text, nullable=False)
    mime_type = Column(String(100), nullable=False, default="application/pdf")
    file_size = Column(Integer, nullable=False)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    uploaded_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scheme = relationship("Scheme", back_populates="documents")
    user = relationship("User")


class Template(Base):
    __tablename__ = "templates"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    scheme_id = Column(UUID(as_uuid=False), ForeignKey("schemes.id"), nullable=False)
    template_name = Column(String(255), nullable=False)
    template_code = Column(String(100), unique=True, nullable=True)
    description = Column(Text, nullable=True)
    status = Column(String(30), default="draft")  # draft / active / archived
    template_content = Column(Text, nullable=True)
    field_groups = Column(JSON, nullable=True)
    created_by = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    scheme = relationship("Scheme", back_populates="templates")
    user = relationship("User")
