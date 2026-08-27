import enum
import uuid
from datetime import datetime

from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Enum, Numeric, Text, Boolean
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from .database import Base


def gen_uuid():
    return str(uuid.uuid4())


class District(Base):
    __tablename__ = "districts"

    id = Column(Integer, primary_key=True)
    name = Column(String(120), nullable=False, unique=True)

    offices = relationship("RegistrationOffice", back_populates="district")


class RegistrationOffice(Base):
    __tablename__ = "registration_offices"

    id = Column(Integer, primary_key=True)
    name = Column(String(150), nullable=False)
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=False)

    district = relationship("District", back_populates="offices")


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    title = Column(String(10), default="Mr.")
    first_name = Column(String(80), nullable=False)
    middle_name = Column(String(80), nullable=True)
    last_name = Column(String(80), nullable=True)

    username = Column(String(60), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    mobile_number = Column(String(15), nullable=False)
    landline_number = Column(String(20), nullable=True)
    email = Column(String(150), unique=True, nullable=False, index=True)
    alternate_email = Column(String(150), nullable=True)
    pan_number = Column(String(15), nullable=True)

    pin_code = Column(String(10), nullable=False)
    state = Column(String(80), nullable=True)
    district_name = Column(String(80), nullable=True)
    city = Column(String(80), nullable=True)

    house_no = Column(String(120), nullable=True)
    building_name = Column(String(150), nullable=True)
    road_street = Column(String(150), nullable=True)
    area_locality = Column(String(150), nullable=True)

    security_question = Column(String(200), nullable=True)
    security_answer_hash = Column(String(255), nullable=True)

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    tokens = relationship("EntryToken", back_populates="user")
    entries = relationship("DocumentEntry", back_populates="user")


class EntryToken(Base):
    """A citizen's slot / token to enter a document at a given registration office."""

    __tablename__ = "entry_tokens"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_number = Column(String(30), unique=True, nullable=False, index=True)

    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)
    language = Column(String(20), default="Marathi")
    district_id = Column(Integer, ForeignKey("districts.id"), nullable=True)
    office_id = Column(Integer, ForeignKey("registration_offices.id"), nullable=True)

    presenter_name = Column(String(150), nullable=True)
    status = Column(String(20), default="OPEN")  # OPEN / SUBMITTED / CANCELLED

    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="tokens")
    district = relationship("District")
    office = relationship("RegistrationOffice")
    entry = relationship("DocumentEntry", back_populates="token", uselist=False)


class ArticleType(Base):
    __tablename__ = "article_types"

    id = Column(Integer, primary_key=True)
    code = Column(String(10), nullable=False)
    name = Column(String(150), nullable=False)
    # Lease / Leave & License articles trigger the "Rent & Other Terms" step.
    has_rent_terms = Column(Boolean, default=False)

    titles = relationship("DocumentTitle", back_populates="article_type")


class DocumentTitle(Base):
    """Marathi document-title options shown once an article is selected."""

    __tablename__ = "document_titles"

    id = Column(Integer, primary_key=True)
    article_type_id = Column(Integer, ForeignKey("article_types.id"), nullable=False)
    label_marathi = Column(String(150), nullable=False)

    article_type = relationship("ArticleType", back_populates="titles")


class RentTerm(Base):
    """Equivalent of the 'Rent & Other Terms' (Presentation Step2) screen,
    shown for Lease / Leave & License articles."""

    __tablename__ = "rent_terms"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_entry_id = Column(UUID(as_uuid=False), ForeignKey("document_entries.id"), nullable=False, unique=True)

    license_period_months = Column(Integer, nullable=True)
    from_date = Column(DateTime, nullable=True)
    to_date = Column(DateTime, nullable=True)
    percent_increment_yearly = Column(Boolean, default=False)

    property_use = Column(String(20), default="Residential")  # Residential / Non-Residential
    refundable_deposit = Column(Numeric(14, 2), nullable=True)
    non_refundable_deposit = Column(Numeric(14, 2), default=0)

    # Rent slabs (From Month / To Month / Rent) stored as JSON list of
    # {"from_month": 1, "to_month": 12, "rent": 15000}
    rent_slabs = Column(Text, nullable=True)

    document_entry = relationship("DocumentEntry", back_populates="rent_term")


class StampPaymentDetail(Base):
    """A single stamp-payment record (Franking / Stamp Paper / Certificate /
    e-Stamp / e-SBTR / e-Challan) attached to a document entry — the
    'Details of Stamp Payment' screen keeps a running table of these."""

    __tablename__ = "stamp_payment_details"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_entry_id = Column(UUID(as_uuid=False), ForeignKey("document_entries.id"), nullable=False)

    paid_by = Column(String(30), nullable=False)  # Franking / Stamp Paper / Certificate / e-Stamp / e-SBTR / e-Challan
    amount = Column(Numeric(14, 2), nullable=False)
    payment_date = Column(DateTime, default=datetime.utcnow)

    # Franking-specific
    franking_mc_no = Column(String(40), nullable=True)
    franking_serial_no = Column(String(60), nullable=True)

    # Stamp paper / certificate / e-stamp specific
    licence_no = Column(String(60), nullable=True)
    vendors_licence_no = Column(String(60), nullable=True)
    vendors_place = Column(String(120), nullable=True)
    serial_no = Column(String(60), nullable=True)
    stationery_number = Column(String(60), nullable=True)

    vendors_name = Column(String(150), nullable=True)
    purchasers_name = Column(String(150), nullable=True)
    epurchasers_name = Column(String(150), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    document_entry = relationship("DocumentEntry", back_populates="stamp_payments")


class DocumentEntry(Base):
    """Equivalent of the 'Presentation Step 1' deed-presentation form."""

    __tablename__ = "document_entries"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    token_id = Column(UUID(as_uuid=False), ForeignKey("entry_tokens.id"), nullable=False)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id"), nullable=False)

    article_type_id = Column(Integer, ForeignKey("article_types.id"), nullable=True)
    document_title = Column(String(150), nullable=True)

    date_of_execution = Column(DateTime, nullable=True)
    date_of_presentation = Column(DateTime, default=datetime.utcnow)

    market_value = Column(Numeric(14, 2), nullable=True)
    consideration_amount = Column(Numeric(14, 2), nullable=True)
    stamp_duty = Column(Numeric(14, 2), nullable=True)
    stamp_duty_paid = Column(Numeric(14, 2), nullable=True)
    stamp_duty_difference = Column(Numeric(14, 2), nullable=True)
    number_of_pages = Column(Integer, nullable=True)

    status = Column(String(20), default="DRAFT")  # DRAFT / SUBMITTED
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    token = relationship("EntryToken", back_populates="entry")
    user = relationship("User", back_populates="entries")
    article_type = relationship("ArticleType")
    rent_term = relationship("RentTerm", back_populates="document_entry", uselist=False)
    stamp_payments = relationship("StampPaymentDetail", back_populates="document_entry")
    properties = relationship("PropertyDetail", back_populates="document_entry", order_by="PropertyDetail.created_at")
    parties = relationship("PartyDetail", back_populates="document_entry", order_by="PartyDetail.created_at")
    identifications = relationship("IdentificationDetail", back_populates="document_entry", order_by="IdentificationDetail.created_at")


class PropertyDetail(Base):
    """'Property Details' step — repeatable, one document entry can have
    multiple properties attached (manual: "Multiple Properties can be added")."""

    __tablename__ = "property_details"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_entry_id = Column(UUID(as_uuid=False), ForeignKey("document_entries.id"), nullable=False)

    district = Column(String(120), nullable=True)
    village_name = Column(String(150), nullable=True)
    urban_rural = Column(String(10), default="Urban")  # Urban / Rural
    hadd_type = Column(String(80), nullable=True)
    hadd_name = Column(String(150), nullable=True)
    taluka = Column(String(120), nullable=True)
    zp = Column(String(120), nullable=True)  # Zilla Parishad — relevant when Rural

    # Attribute Type is a multi-select capped at 2 (Survey Number / C.T.S.
    # Number / Plot Number / ...); stored as JSON list of {type, value}.
    attributes = Column(Text, nullable=True)  # JSON string: [{"type": "...", "value": "..."}]

    area = Column(Numeric(14, 2), nullable=True)
    area_unit = Column(String(30), default="Square Foot")
    property_type = Column(String(80), nullable=True)
    pui_number = Column(String(60), nullable=True)  # Property Tax No. / PUI
    pui_verified = Column(Boolean, default=False)

    address_type = Column(String(20), default="Address")  # Address / Other Details

    # English / Marathi parallel address fields
    flat_no_en = Column(String(60), nullable=True)
    flat_no_mr = Column(String(60), nullable=True)
    floor_no_en = Column(String(60), nullable=True)
    floor_no_mr = Column(String(60), nullable=True)
    building_name_en = Column(String(150), nullable=True)
    building_name_mr = Column(String(150), nullable=True)
    block_sector_en = Column(String(150), nullable=True)
    block_sector_mr = Column(String(150), nullable=True)
    road_en = Column(String(150), nullable=True)
    road_mr = Column(String(150), nullable=True)
    other_desc = Column(Text, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    document_entry = relationship("DocumentEntry", back_populates="properties")


class PartyDetail(Base):
    """'Party Details' step — repeatable (manual: "Multiple Parties can be
    added"). Covers Seller/Purchaser/Bank/etc. party types."""

    __tablename__ = "party_details"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_entry_id = Column(UUID(as_uuid=False), ForeignKey("document_entries.id"), nullable=False)

    party_type = Column(String(80), nullable=True)  # e.g. Seller/Vendor, Purchaser

    surname_en = Column(String(80), nullable=True)
    first_name_en = Column(String(80), nullable=True)
    middle_name_en = Column(String(80), nullable=True)
    surname_mr = Column(String(80), nullable=True)
    first_name_mr = Column(String(80), nullable=True)
    middle_name_mr = Column(String(80), nullable=True)
    age = Column(Integer, nullable=True)

    is_bank = Column(Boolean, default=False)
    is_stamp_purchaser = Column(Boolean, default=False)
    is_presentor = Column(Boolean, default=False)

    flat_no_en = Column(String(60), nullable=True)
    flat_no_mr = Column(String(60), nullable=True)
    floor_no_en = Column(String(60), nullable=True)
    floor_no_mr = Column(String(60), nullable=True)
    building_name_en = Column(String(150), nullable=True)
    building_name_mr = Column(String(150), nullable=True)
    block_sector_en = Column(String(150), nullable=True)
    block_sector_mr = Column(String(150), nullable=True)
    road_en = Column(String(150), nullable=True)
    road_mr = Column(String(150), nullable=True)

    pin_code = Column(String(10), nullable=True)
    country = Column(String(60), default="India")
    state_en = Column(String(80), nullable=True)
    state_mr = Column(String(80), nullable=True)
    city_en = Column(String(80), nullable=True)
    city_mr = Column(String(80), nullable=True)
    district_name = Column(String(80), nullable=True)

    uid = Column(String(20), nullable=True)  # Aadhaar-style UID
    mobile_number = Column(String(15), nullable=True)
    identification_mark1 = Column(String(120), nullable=True)
    identification_mark2 = Column(String(120), nullable=True)

    pan_number = Column(String(15), nullable=True)
    pan_verified = Column(Boolean, default=False)
    declaration_form_60_61 = Column(Boolean, default=False)  # used when PAN absent

    identification_proof = Column(String(60), nullable=True)
    identification_proof_number = Column(String(60), nullable=True)
    email = Column(String(150), nullable=True)

    is_document_signed = Column(Boolean, default=True)
    is_exemption_section_88 = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)

    document_entry = relationship("DocumentEntry", back_populates="parties")


class IdentificationDetail(Base):
    """'Identification Details' step — repeatable (manual: "Multiple
    Identifiers/witnesses can be added")."""

    __tablename__ = "identification_details"

    id = Column(UUID(as_uuid=False), primary_key=True, default=gen_uuid)
    document_entry_id = Column(UUID(as_uuid=False), ForeignKey("document_entries.id"), nullable=False)

    surname_en = Column(String(80), nullable=True)
    first_name_en = Column(String(80), nullable=True)
    middle_name_en = Column(String(80), nullable=True)
    surname_mr = Column(String(80), nullable=True)
    first_name_mr = Column(String(80), nullable=True)
    middle_name_mr = Column(String(80), nullable=True)

    address_en = Column(Text, nullable=True)
    address_mr = Column(Text, nullable=True)

    age = Column(Integer, nullable=True)
    pin_code = Column(String(10), nullable=True)
    identification_proof = Column(String(60), nullable=True)
    proof_number = Column(String(60), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)

    document_entry = relationship("DocumentEntry", back_populates="identifications")
