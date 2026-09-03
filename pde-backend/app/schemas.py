from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, EmailStr, ConfigDict, Field, field_validator, model_validator

from .validators import (
    has_bilingual_name,
    validate_age_optional,
    validate_email_optional,
    validate_mobile_optional,
    validate_mobile_required,
    validate_non_empty_str,
    validate_pan_optional,
    validate_password,
    validate_pin_code,
    validate_positive_decimal,
    validate_token_number,
    validate_username,
)


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

    @field_validator("username")
    @classmethod
    def _username(cls, v: str) -> str:
        return validate_username(v)

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validate_password(v)

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v: str) -> str:
        return validate_mobile_required(v)

    @field_validator("pin_code")
    @classmethod
    def _pin(cls, v: str) -> str:
        return validate_pin_code(v)

    @field_validator("pan_number")
    @classmethod
    def _pan(cls, v: Optional[str]) -> Optional[str]:
        return validate_pan_optional(v)


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    first_name: str
    last_name: Optional[str] = None
    username: str
    email: EmailStr
    mobile_number: str
    is_guest: bool = False


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

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v: str) -> str:
        return validate_mobile_required(v)

    @field_validator("pin_code")
    @classmethod
    def _pin(cls, v: str) -> str:
        return validate_pin_code(v)

    @field_validator("pan_number")
    @classmethod
    def _pan(cls, v: Optional[str]) -> Optional[str]:
        return validate_pan_optional(v)


# ---------- Change / Forgot Password, Forgot UserName ----------

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def _new_password(cls, v: str) -> str:
        return validate_password(v)


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

    @field_validator("new_password")
    @classmethod
    def _new_password(cls, v: str) -> str:
        return validate_password(v)


class ForgotUsernameSendOtpRequest(BaseModel):
    mobile_number: str
    security_question: str
    security_answer: str

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v: str) -> str:
        return validate_mobile_required(v)


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
    slot_booking_id: Optional[str] = None


class TokenEntryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    token_number: str
    language: str
    district_id: Optional[int] = None
    district_name: Optional[str] = None
    office_id: Optional[int] = None
    office_name: Optional[str] = None
    presenter_name: Optional[str] = None
    slot_booking_id: Optional[str] = None
    status: str
    created_at: datetime

    # Rolled up from the linked DocumentEntry (if the citizen has started
    # filling one in) so the token list can show these without N extra
    # requests per row.
    entry_id: Optional[str] = None
    entry_status: Optional[str] = None
    is_draft: bool = False
    party_count: int = 0
    identifier_count: int = 0
    property_count: int = 0


class TokenEntryUpdate(BaseModel):
    """Edit Token Details — token-level metadata only. Once a token has
    moved past OPEN (submitted/cancelled) it's no longer editable."""
    language: str = "Marathi"
    district_id: Optional[int] = None
    office_id: Optional[int] = None
    presenter_name: Optional[str] = None


class TokenFilter(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    presenter_name: Optional[str] = None


class GuestTokenStart(BaseModel):
    """Data Entry without Login → Start Registration New Entry."""

    language: str = "Marathi"
    district_id: Optional[int] = None
    office_id: Optional[int] = None
    presenter_name: Optional[str] = None
    password: str = Field(..., min_length=8)


class GuestTokenResume(BaseModel):
    """Data Entry without Login → Modify Old Entry (11-digit token + password)."""

    token_number: str = Field(..., min_length=11, max_length=11)
    password: str

    @field_validator("token_number")
    @classmethod
    def _token_number(cls, v: str) -> str:
        return validate_token_number(v)


class GuestSessionOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    token: TokenEntryOut


# ---------- Document Entry ----------

class DocumentEntryCreate(BaseModel):
    token_id: str
    article_type_id: int
    document_title: Optional[str] = None
    date_of_execution: Optional[datetime] = None
    date_of_presentation: Optional[datetime] = None
    market_value: Decimal
    consideration_amount: Decimal
    number_of_pages: Optional[int] = Field(default=None, ge=1)

    @field_validator("market_value", "consideration_amount")
    @classmethod
    def _amounts(cls, v: Decimal) -> Decimal:
        return validate_positive_decimal(v, "Value")  # type: ignore[return-value]

    @model_validator(mode="after")
    def _presentation_dates(self):
        if self.date_of_execution and self.date_of_presentation:
            if self.date_of_presentation.date() < self.date_of_execution.date():
                raise ValueError("Date of presentation cannot be before date of execution")
        return self


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
    token_number: Optional[str] = None
    district_name: Optional[str] = None
    office_name: Optional[str] = None


class StampDutyCalcRequest(BaseModel):
    market_value: Decimal
    consideration_amount: Decimal
    article_type_id: Optional[int] = None

    @field_validator("market_value", "consideration_amount")
    @classmethod
    def _amounts(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Market value and consideration amount must be greater than zero")
        return v


class StampDutyCalcResponse(BaseModel):
    stamp_duty: Decimal
    rate_percent: Decimal


# ---------- Rent & Other Terms (Presentation Step2) ----------

class RentSlab(BaseModel):
    from_month: int
    to_month: int
    rent: Decimal

    @field_validator("rent")
    @classmethod
    def _rent(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("Rent cannot be negative")
        return v

    @field_validator("from_month", "to_month")
    @classmethod
    def _months_in_range(cls, v: int) -> int:
        if v < 1 or v > 12:
            raise ValueError("Month must be between 1 and 12")
        return v

    @model_validator(mode="after")
    def _month_order(self):
        if self.to_month < self.from_month:
            raise ValueError("'To month' cannot be before 'From month' in a rent slab")
        return self


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

    @field_validator("refundable_deposit", "non_refundable_deposit")
    @classmethod
    def _deposits(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return validate_positive_decimal(v, "Deposit")

    @field_validator("license_period_months")
    @classmethod
    def _license_period(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 1:
            raise ValueError("License period must be at least 1 month")
        return v

    @model_validator(mode="after")
    def _date_order(self):
        if self.from_date and self.to_date and self.to_date < self.from_date:
            raise ValueError("To date cannot be before From date")
        return self


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
    amount: Decimal = Field(..., gt=0)
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

    @field_validator("document_entry_id", "paid_by")
    @classmethod
    def _required_text(cls, v: str) -> str:
        return validate_non_empty_str(v, "Field")


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

    @field_validator("clause_id")
    @classmethod
    def _clause(cls, v: str) -> str:
        return validate_non_empty_str(v, "Clause")

    @field_validator("market_value", "consideration_amount")
    @classmethod
    def _amounts(cls, v: Decimal) -> Decimal:
        if v <= 0:
            raise ValueError("Market value and consideration amount must be greater than zero")
        return v

    @field_validator("surcharge_percent", "metro_cess_percent", "railway_cess_percent")
    @classmethod
    def _percents(cls, v: Decimal) -> Decimal:
        return validate_positive_decimal(v, "Percentage")


class StampDutyAdvancedResponse(BaseModel):
    actual_stamp_duty: Decimal
    surcharge: Decimal
    total_stamp_duty: Decimal


# ---------- Property Details (repeatable) ----------

class PropertyAttribute(BaseModel):
    type: str
    value: str


class PropertyDetailCreate(BaseModel):
    district: str
    village_name: str
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
    eother_desc: Optional[str] = None
    potkharaba_area: Optional[Decimal] = Decimal("0.0")
    other_right_mr: Optional[str] = None
    other_right_en: Optional[str] = None

    @field_validator("district", "village_name")
    @classmethod
    def _required_text(cls, v: str) -> str:
        return validate_non_empty_str(v, "Field")

    @field_validator("area")
    @classmethod
    def _area(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("Area must be greater than zero when provided")
        return v

    @model_validator(mode="after")
    def _attributes_limit(self):
        if len(self.attributes) > 2:
            raise ValueError("Maximum 2 attributes can be selected")
        return self


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
    address_type: Optional[str] = "Address"
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
    eother_desc: Optional[str] = None
    potkharaba_area: Optional[Decimal] = Decimal("0.0")
    other_right_mr: Optional[str] = None
    other_right_en: Optional[str] = None
    property_code: Optional[str] = None


class PuiVerifyRequest(BaseModel):
    pui_number: str

    @field_validator("pui_number")
    @classmethod
    def _pui(cls, v: str) -> str:
        return validate_non_empty_str(v, "PUI / Property Tax number")


class PuiVerifyResponse(BaseModel):
    pui_number: str
    verified: bool
    note: str = "Illustrative check only — wire up to the real PUI/property-tax service before relying on this."


# ---------- Party Details (repeatable) ----------

class PartyDetailCreate(BaseModel):
    party_type: str
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

    # Gap 2 fields
    party_sr_no: Optional[int] = None
    alias_name_mr: Optional[str] = None
    alias_name_en: Optional[str] = None
    id_type: Optional[str] = None
    id_no: Optional[str] = None
    full_pan_name: Optional[str] = None
    survey_no: Optional[str] = None
    khata_no: Optional[str] = None
    party_area: Optional[Decimal] = None
    vikri_area: Optional[Decimal] = None
    potkharaba_area: Optional[Decimal] = None
    potkharaba_vikri_area: Optional[Decimal] = None
    seller_khata_no: Optional[str] = None
    seller_first_name: Optional[str] = None
    seller_middle_name: Optional[str] = None
    seller_last_name: Optional[str] = None
    mobile_number_verified: bool = False

    @field_validator("party_type")
    @classmethod
    def _party_type(cls, v: str) -> str:
        return validate_non_empty_str(v, "Party type")

    @field_validator("pan_number")
    @classmethod
    def _pan(cls, v: Optional[str]) -> Optional[str]:
        return validate_pan_optional(v)

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v: Optional[str]) -> Optional[str]:
        return validate_mobile_optional(v)

    @field_validator("pin_code")
    @classmethod
    def _pin(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return validate_pin_code(str(v))

    @field_validator("age")
    @classmethod
    def _age(cls, v: Optional[int]) -> Optional[int]:
        return validate_age_optional(v)

    @field_validator("email")
    @classmethod
    def _email(cls, v: Optional[str]) -> Optional[str]:
        return validate_email_optional(v)

    @model_validator(mode="after")
    def _party_rules(self):
        if not self.pan_number and not self.declaration_form_60_61:
            raise ValueError(
                "Provide a PAN number, or check 'Is Declaration Attached (Form 60/61)'."
            )
        if not has_bilingual_name(
            self.first_name_en,
            self.first_name_mr,
            self.surname_en,
            self.surname_mr,
        ):
            raise ValueError("Party name (English or Marathi) is required")
        return self


class PartyDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_entry_id: str
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
    country: Optional[str] = "India"
    state_en: Optional[str] = None
    state_mr: Optional[str] = None
    city_en: Optional[str] = None
    city_mr: Optional[str] = None
    district_name: Optional[str] = None
    uid: Optional[str] = None
    mobile_number: Optional[str] = None
    mobile_number_verified: bool = False
    identification_mark1: Optional[str] = None
    identification_mark2: Optional[str] = None
    pan_number: Optional[str] = None
    pan_verified: bool = False
    declaration_form_60_61: bool = False
    identification_proof: Optional[str] = None
    identification_proof_number: Optional[str] = None
    email: Optional[str] = None
    is_document_signed: bool = True
    is_exemption_section_88: bool = False

    party_sr_no: Optional[int] = None
    alias_name_mr: Optional[str] = None
    alias_name_en: Optional[str] = None
    id_type: Optional[str] = None
    id_no: Optional[str] = None
    full_pan_name: Optional[str] = None
    survey_no: Optional[str] = None
    khata_no: Optional[str] = None
    party_area: Optional[Decimal] = None
    vikri_area: Optional[Decimal] = None
    potkharaba_area: Optional[Decimal] = None
    potkharaba_vikri_area: Optional[Decimal] = None
    seller_khata_no: Optional[str] = None
    seller_first_name: Optional[str] = None
    seller_middle_name: Optional[str] = None
    seller_last_name: Optional[str] = None

    address_combined: Optional[str] = None


class PanVerifyRequest(BaseModel):
    pan_number: str

    @field_validator("pan_number")
    @classmethod
    def _pan(cls, v: str) -> str:
        result = validate_pan_optional(v)
        if not result:
            raise ValueError("PAN number is required")
        return result


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
    age: int
    pin_code: Optional[str] = None
    identification_proof: str
    proof_number: str

    @field_validator("age")
    @classmethod
    def _age(cls, v: int) -> int:
        result = validate_age_optional(v)
        if result is None:
            raise ValueError("Age is required")
        return result

    @field_validator("identification_proof", "proof_number")
    @classmethod
    def _proof_fields(cls, v: str) -> str:
        return validate_non_empty_str(v, "Field")

    @field_validator("pin_code")
    @classmethod
    def _pin(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return validate_pin_code(str(v))

    @model_validator(mode="after")
    def _witness_name(self):
        if not has_bilingual_name(
            self.first_name_en,
            self.first_name_mr,
            self.surname_en,
            self.surname_mr,
        ):
            raise ValueError("Witness name (English or Marathi) is required")
        if not (self.address_en and self.address_en.strip()) and not (
            self.address_mr and self.address_mr.strip()
        ):
            raise ValueError("Witness address (English or Marathi) is required")
        return self


class IdentificationDetailOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    document_entry_id: str
    surname_en: Optional[str] = None
    first_name_en: Optional[str] = None
    middle_name_en: Optional[str] = None
    surname_mr: Optional[str] = None
    first_name_mr: Optional[str] = None
    middle_name_mr: Optional[str] = None
    age: Optional[int] = None
    address_en: Optional[str] = None
    address_mr: Optional[str] = None
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
