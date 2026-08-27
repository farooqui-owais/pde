from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict


# ---------- Auth / User ----------

class UserCreate(BaseModel):
    title: str = "Mr."
    first_name: str
    middle_name: Optional[str] = None
    last_name: Optional[str] = None

    username: str
    password: str

    mobile_number: str
    landline_number: Optional[str] = None
    email: EmailStr
    alternate_email: Optional[str] = None
    pan_number: Optional[str] = None

    pin_code: str
    state: Optional[str] = None
    district_name: Optional[str] = None
    city: Optional[str] = None

    house_no: Optional[str] = None
    building_name: Optional[str] = None
    road_street: Optional[str] = None
    area_locality: Optional[str] = None

    security_question: Optional[str] = None
    security_answer: Optional[str] = None


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    first_name: str
    last_name: Optional[str] = None
    username: str
    email: EmailStr
    mobile_number: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class LoginRequest(BaseModel):
    username: str
    password: str


class UsernameAvailability(BaseModel):
    username: str
    available: bool


class UserUpdate(BaseModel):
    """Fields a signed-in user may edit from Update Profile. Username,
    password and security question/answer are changed via their own
    dedicated flows, not this endpoint."""

    title: str = "Mr."
    first_name: str
    middle_name: Optional[str] = None
    last_name: Optional[str] = None

    mobile_number: str
    landline_number: Optional[str] = None
    email: EmailStr
    alternate_email: Optional[str] = None
    pan_number: Optional[str] = None

    pin_code: str
    state: Optional[str] = None
    district_name: Optional[str] = None
    city: Optional[str] = None

    house_no: Optional[str] = None
    building_name: Optional[str] = None
    road_street: Optional[str] = None
    area_locality: Optional[str] = None


# ---------- Change / Forgot Password, Forgot UserName ----------

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str


class VerifyPasswordRequest(BaseModel):
    password: str


class ForgotPasswordVerifyRequest(BaseModel):
    username: str
    security_question: str
    security_answer: str


class ForgotPasswordVerifyResponse(BaseModel):
    reset_token: str
    expires_in_seconds: int = 300


class ForgotPasswordResetRequest(BaseModel):
    reset_token: str
    new_password: str


class ForgotUsernameSendOtpRequest(BaseModel):
    mobile_number: str
    security_question: str
    security_answer: str


class ForgotUsernameSendOtpResponse(BaseModel):
    otp_token: str
    expires_in_seconds: int = 300
    dev_otp: Optional[str] = None
    note: str = (
        "Illustrative only — no SMS gateway is wired up in this clone, so the "
        "OTP is returned here instead of being texted. Wire up a real SMS "
        "provider before relying on this."
    )


class ForgotUsernameVerifyOtpRequest(BaseModel):
    otp_token: str
    otp: str


class ForgotUsernameVerifyOtpResponse(BaseModel):
    username: str


# ---------- Reference data ----------

class DistrictOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str


class OfficeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    district_id: int


class ArticleTypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    code: str
    name: str
    has_rent_terms: bool = False


class DocumentTitleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    article_type_id: int
    label_marathi: str


# ---------- Tokens ----------

class TokenEntryCreate(BaseModel):
    language: str = "Marathi"
    district_id: Optional[int] = None
    office_id: Optional[int] = None
    presenter_name: Optional[str] = None


class TokenEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    token_number: str
    language: str
    district_id: Optional[int] = None
    office_id: Optional[int] = None
    presenter_name: Optional[str] = None
    status: str
    created_at: datetime


class TokenFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    presenter_name: Optional[str] = None


# ---------- Document Entry ----------

class DocumentEntryCreate(BaseModel):
    token_id: str
    article_type_id: Optional[int] = None
    document_title: Optional[str] = None
    date_of_execution: Optional[datetime] = None
    date_of_presentation: Optional[datetime] = None
    market_value: Optional[Decimal] = None
    consideration_amount: Optional[Decimal] = None
    number_of_pages: Optional[int] = None


class DocumentEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    token_id: str
    article_type_id: Optional[int] = None
    document_title: Optional[str] = None
    date_of_execution: Optional[datetime] = None
    date_of_presentation: Optional[datetime] = None
    market_value: Optional[Decimal] = None
    consideration_amount: Optional[Decimal] = None
    stamp_duty: Optional[Decimal] = None
    stamp_duty_paid: Optional[Decimal] = None
    stamp_duty_difference: Optional[Decimal] = None
    number_of_pages: Optional[int] = None
    status: str


class StampDutyCalcRequest(BaseModel):
    market_value: Decimal
    consideration_amount: Decimal
    article_type_id: Optional[int] = None


class StampDutyCalcResponse(BaseModel):
    stamp_duty: Decimal
    rate_percent: Decimal


# ---------- Rent & Other Terms (Presentation Step2) ----------

class RentSlab(BaseModel):
    from_month: int
    to_month: int
    rent: Decimal


class RentTermCreate(BaseModel):
    document_entry_id: str
    license_period_months: Optional[int] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    percent_increment_yearly: bool = False
    property_use: str = "Residential"
    refundable_deposit: Optional[Decimal] = None
    non_refundable_deposit: Optional[Decimal] = 0
    rent_slabs: list[RentSlab] = []


class RentTermOut(BaseModel):
    id: str
    document_entry_id: str
    license_period_months: Optional[int] = None
    from_date: Optional[datetime] = None
    to_date: Optional[datetime] = None
    percent_increment_yearly: bool
    property_use: str
    refundable_deposit: Optional[Decimal] = None
    non_refundable_deposit: Optional[Decimal] = None
    rent_slabs: list[RentSlab] = []


# ---------- Details of Stamp Payment ----------

class StampPaymentCreate(BaseModel):
    document_entry_id: str
    paid_by: str
    amount: Decimal
    payment_date: Optional[datetime] = None
    franking_mc_no: Optional[str] = None
    franking_serial_no: Optional[str] = None
    licence_no: Optional[str] = None
    vendors_licence_no: Optional[str] = None
    vendors_place: Optional[str] = None
    serial_no: Optional[str] = None
    stationery_number: Optional[str] = None
    vendors_name: Optional[str] = None
    purchasers_name: Optional[str] = None
    epurchasers_name: Optional[str] = None


class StampPaymentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_entry_id: str
    paid_by: str
    amount: Decimal
    payment_date: Optional[datetime] = None
    franking_mc_no: Optional[str] = None
    franking_serial_no: Optional[str] = None
    licence_no: Optional[str] = None
    vendors_licence_no: Optional[str] = None
    vendors_place: Optional[str] = None
    serial_no: Optional[str] = None
    stationery_number: Optional[str] = None
    vendors_name: Optional[str] = None
    purchasers_name: Optional[str] = None
    epurchasers_name: Optional[str] = None


# ---------- Advanced Stamp Duty Calculate (clause tree) ----------

class StampDutyAdvancedRequest(BaseModel):
    clause_id: str
    market_value: Decimal
    consideration_amount: Decimal
    surcharge_percent: Decimal = Decimal("1")
    metro_cess_percent: Decimal = Decimal("0")
    railway_cess_percent: Decimal = Decimal("0")
    is_investor_clause: bool = False


class StampDutyAdvancedResponse(BaseModel):
    actual_stamp_duty: Decimal
    surcharge: Decimal
    total_stamp_duty: Decimal


# ---------- Property Details (repeatable) ----------

class PropertyAttribute(BaseModel):
    type: str
    value: str


class PropertyDetailCreate(BaseModel):
    district: Optional[str] = None
    village_name: Optional[str] = None
    urban_rural: str = "Urban"
    hadd_type: Optional[str] = None
    hadd_name: Optional[str] = None
    taluka: Optional[str] = None
    zp: Optional[str] = None
    attributes: list[PropertyAttribute] = []  # UI/API enforce max 2, matching the manual's note
    area: Optional[Decimal] = None
    area_unit: str = "Square Foot"
    property_type: Optional[str] = None
    pui_number: Optional[str] = None
    address_type: str = "Address"
    flat_no_en: Optional[str] = None
    flat_no_mr: Optional[str] = None
    floor_no_en: Optional[str] = None
    floor_no_mr: Optional[str] = None
    building_name_en: Optional[str] = None
    building_name_mr: Optional[str] = None
    block_sector_en: Optional[str] = None
    block_sector_mr: Optional[str] = None
    road_en: Optional[str] = None
    road_mr: Optional[str] = None
    other_desc: Optional[str] = None


class PropertyDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_entry_id: str
    district: Optional[str] = None
    village_name: Optional[str] = None
    urban_rural: str
    hadd_type: Optional[str] = None
    hadd_name: Optional[str] = None
    taluka: Optional[str] = None
    zp: Optional[str] = None
    attributes: list[PropertyAttribute] = []
    area: Optional[Decimal] = None
    area_unit: str
    property_type: Optional[str] = None
    pui_number: Optional[str] = None
    pui_verified: bool = False
    building_name_en: Optional[str] = None
    road_en: Optional[str] = None
    other_desc: Optional[str] = None


class PuiVerifyRequest(BaseModel):
    pui_number: str


class PuiVerifyResponse(BaseModel):
    pui_number: str
    verified: bool
    note: str = "Illustrative check only — wire up to the real PUI/property-tax service before relying on this."


# ---------- Party Details (repeatable) ----------

class PartyDetailCreate(BaseModel):
    party_type: Optional[str] = None
    surname_en: Optional[str] = None
    first_name_en: Optional[str] = None
    middle_name_en: Optional[str] = None
    surname_mr: Optional[str] = None
    first_name_mr: Optional[str] = None
    middle_name_mr: Optional[str] = None
    age: Optional[int] = None
    is_bank: bool = False
    is_stamp_purchaser: bool = False
    is_presentor: bool = False
    flat_no_en: Optional[str] = None
    flat_no_mr: Optional[str] = None
    floor_no_en: Optional[str] = None
    floor_no_mr: Optional[str] = None
    building_name_en: Optional[str] = None
    building_name_mr: Optional[str] = None
    block_sector_en: Optional[str] = None
    block_sector_mr: Optional[str] = None
    road_en: Optional[str] = None
    road_mr: Optional[str] = None
    pin_code: Optional[str] = None
    country: str = "India"
    state_en: Optional[str] = None
    state_mr: Optional[str] = None
    city_en: Optional[str] = None
    city_mr: Optional[str] = None
    district_name: Optional[str] = None
    uid: Optional[str] = None
    mobile_number: Optional[str] = None
    identification_mark1: Optional[str] = None
    identification_mark2: Optional[str] = None
    pan_number: Optional[str] = None
    declaration_form_60_61: bool = False
    identification_proof: Optional[str] = None
    identification_proof_number: Optional[str] = None
    email: Optional[str] = None
    is_document_signed: bool = True
    is_exemption_section_88: bool = False


class PartyDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_entry_id: str
    party_type: Optional[str] = None
    surname_en: Optional[str] = None
    first_name_en: Optional[str] = None
    middle_name_en: Optional[str] = None
    age: Optional[int] = None
    is_bank: bool
    is_stamp_purchaser: bool
    is_presentor: bool
    pin_code: Optional[str] = None
    pan_number: Optional[str] = None
    pan_verified: bool = False
    mobile_number: Optional[str] = None
    is_document_signed: bool
    is_exemption_section_88: bool


class PanVerifyRequest(BaseModel):
    pan_number: str


class PanVerifyResponse(BaseModel):
    pan_number: str
    verified: bool
    note: str = "Illustrative check only — wire up to the real PAN verification service before relying on this."


# ---------- Identification Details (repeatable) ----------

class IdentificationDetailCreate(BaseModel):
    surname_en: Optional[str] = None
    first_name_en: Optional[str] = None
    middle_name_en: Optional[str] = None
    surname_mr: Optional[str] = None
    first_name_mr: Optional[str] = None
    middle_name_mr: Optional[str] = None
    address_en: Optional[str] = None
    address_mr: Optional[str] = None
    age: Optional[int] = None
    pin_code: Optional[str] = None
    identification_proof: Optional[str] = None
    proof_number: Optional[str] = None


class IdentificationDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_entry_id: str
    surname_en: Optional[str] = None
    first_name_en: Optional[str] = None
    middle_name_en: Optional[str] = None
    age: Optional[int] = None
    address_en: Optional[str] = None
    pin_code: Optional[str] = None
    identification_proof: Optional[str] = None
    proof_number: Optional[str] = None


# ---------- Public Data Entry Report + Confirmation ----------

class PublicDataEntryReportOut(BaseModel):
    """Mirrors the 13-numbered-field bilingual report generated after all
    steps are filled in (manual: 'Public Data Entry Report')."""

    token_number: str
    document_type: Optional[str] = None
    consideration_amount: Optional[Decimal] = None
    market_value: Optional[Decimal] = None
    required_stamp_duty: Optional[Decimal] = None
    date_of_execution: Optional[datetime] = None
    village_name: Optional[str] = None
    number_of_pages: Optional[int] = None
    survey_cts_numbers: list[str] = []
    tenure_and_area: Optional[str] = None
    area: Optional[Decimal] = None
    executants: list[dict] = []   # parties where is_presentor/is_stamp_purchaser style role = giving
    claimants: list[dict] = []    # remaining parties = receiving
    witnesses: list[dict] = []    # identifications


class ConcurrentOfficeOut(BaseModel):
    id: int
    name: str


class ConfirmationOut(BaseModel):
    token_number: str
    status: str
    message: str = "Your Data Save Successfully. Go to Concurrent SRO Offices with print out for Registration."
    concurrent_offices: list[ConcurrentOfficeOut] = []
