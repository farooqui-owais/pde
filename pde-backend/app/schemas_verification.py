from datetime import datetime
from decimal import Decimal
from typing import Optional, Any, Dict

from pydantic import BaseModel, ConfigDict, Field, field_validator

from .validators import validate_capture_type, validate_positive_decimal


# ---------------- Execution Capture ----------------

class ExecutionCaptureCreate(BaseModel):
    party_id: Optional[str] = None
    capture_type: str = Field(..., description="PHOTO / FINGERPRINT / SIGNATURE_PAD")
    storage_key: Optional[str] = None
    device_reference: Optional[str] = None
    extra_metadata: Optional[Dict[str, Any]] = None

    @field_validator("capture_type")
    @classmethod
    def _capture_type(cls, v: str) -> str:
        return validate_capture_type(v)


class ExecutionCaptureUpdate(BaseModel):
    status: Optional[str] = None
    storage_key: Optional[str] = None
    extra_metadata: Optional[Dict[str, Any]] = None


class ExecutionCaptureOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_entry_id: str
    party_id: Optional[str] = None
    capture_type: str
    storage_key: Optional[str] = None
    device_reference: Optional[str] = None
    status: str
    captured_at: datetime
    extra_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


# ---------------- eKYC Verification ----------------

class EkycVerificationCreate(BaseModel):
    party_id: Optional[str] = None
    provider: Optional[str] = None
    verification_type: Optional[str] = None
    # Accept the full identifier only at the API boundary so it can be sent
    # to a verification provider; it is masked before persistence and the
    # raw value is never stored or echoed back.
    identifier: Optional[str] = Field(
        default=None,
        min_length=4,
        max_length=32,
        description="Raw identifier (e.g. Aadhaar) used only to call the verification provider; never persisted.",
    )


class EkycVerificationStatusUpdate(BaseModel):
    status: str
    reference_id: Optional[str] = None
    provider_response_summary: Optional[Dict[str, Any]] = None


class EkycVerificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_entry_id: str
    party_id: Optional[str] = None
    provider: Optional[str] = None
    verification_type: Optional[str] = None
    masked_identifier: Optional[str] = None
    reference_id: Optional[str] = None
    status: str
    verified_at: Optional[datetime] = None
    provider_response_summary: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime


# ---------------- Sign Agreement ----------------

class SignAgreementCreate(BaseModel):
    party_id: Optional[str] = None
    method: Optional[str] = None


class SignAgreementStatusUpdate(BaseModel):
    status: str
    signature_storage_key: Optional[str] = None


class SignAgreementOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    document_entry_id: str
    party_id: Optional[str] = None
    method: Optional[str] = None
    status: str
    signed_at: Optional[datetime] = None
    signature_storage_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# ---------------- Valuation Rate (master data) ----------------

class ValuationRateBase(BaseModel):
    state: Optional[str] = "Maharashtra"
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    rate_per_sqft: Optional[Decimal] = None
    rate_per_sqm: Optional[Decimal] = None
    rate_per_acre: Optional[Decimal] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None

    @field_validator("rate_per_sqft", "rate_per_sqm", "rate_per_acre")
    @classmethod
    def _rates(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("Valuation rates cannot be negative")
        return v


class ValuationRateCreate(ValuationRateBase):
    district: str
    village: str


class ValuationRateUpdate(BaseModel):
    rate_per_sqft: Optional[Decimal] = None
    rate_per_sqm: Optional[Decimal] = None
    rate_per_acre: Optional[Decimal] = None
    effective_from: Optional[datetime] = None
    effective_to: Optional[datetime] = None
    is_active: Optional[bool] = None


class ValuationRateOut(ValuationRateBase):
    model_config = ConfigDict(from_attributes=True)

    id: str
    is_active: bool
    created_at: datetime
    updated_at: datetime
