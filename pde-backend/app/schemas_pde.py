# schemas_pde.py
"""Pydantic schemas for the iSarita Public Data Entry (PDE) module.
These correspond to the models defined in `models_pde.py`.
"""

from datetime import datetime
from typing import List, Optional, Dict, Any

from pydantic import BaseModel, Field, validator

# ---------------------------------------------------------------------------
# Token schemas
# ---------------------------------------------------------------------------
class TokenCreate(BaseModel):
    token_number: str = Field(..., description="11‑digit token number generated for the citizen")
    password: str = Field(..., min_length=8, description="Password meeting complexity rules")

class TokenResponse(BaseModel):
    id: str
    token_number: str
    created_at: datetime
    status: str

    class Config:
        orm_mode = True

class TokenVerify(BaseModel):
    token_number: str
    password: str

class TokenVerifyResponse(BaseModel):
    valid: bool
    status: str

# ---------------------------------------------------------------------------
# Presentation step schemas
# ---------------------------------------------------------------------------
class PresentationCreate(BaseModel):
    article: str
    document_title: str
    execution_date: datetime
    market_value: Optional[float] = None
    consideration: Optional[float] = None
    stamp_duty: Optional[float] = None
    page_count: Optional[int] = None

class PresentationResponse(BaseModel):
    id: str
    token_id: str
    article: str
    document_title: str
    execution_date: datetime
    presentation_date: datetime
    market_value: Optional[float]
    consideration: Optional[float]
    stamp_duty: Optional[float]
    stamp_duty_paid: Optional[float] = None
    stamp_duty_difference: Optional[float] = None
    page_count: Optional[int]
    created_at: datetime

    class Config:
        orm_mode = True

# ---------------------------------------------------------------------------
# Property step schemas
# ---------------------------------------------------------------------------
class PropertyCreate(BaseModel):
    district: str
    village: str
    urban_rural: str
    hadd_type: str
    hadd_name: str
    taluka: str
    zp: Optional[str] = None
    attributes: Optional[Dict[str, Any]] = None
    area: Optional[float] = None
    area_unit: Optional[str] = None
    property_type: str
    pui_number: Optional[str] = None

class PropertyResponse(BaseModel):
    id: str
    token_id: str
    district: str
    village: str
    urban_rural: str
    hadd_type: str
    hadd_name: str
    taluka: str
    zp: Optional[str]
    attributes: Optional[Dict[str, Any]]
    area: Optional[float]
    area_unit: Optional[str]
    property_type: str
    pui_number: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True

# ---------------------------------------------------------------------------
# Party step schemas
# ---------------------------------------------------------------------------
class PartyCreate(BaseModel):
    party_type: str
    name_en: str
    name_mr: str
    age: Optional[int] = None
    is_bank: bool = False
    is_stamp_purchaser: bool = False
    is_presentor: bool = False
    address: Optional[Dict[str, Any]] = None
    pin_code: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    pan: Optional[str] = None
    uid: Optional[str] = None

class PartyResponse(BaseModel):
    id: str
    token_id: str
    party_type: str
    name_en: str
    name_mr: str
    age: Optional[int]
    is_bank: bool
    is_stamp_purchaser: bool
    is_presentor: bool
    address: Optional[Dict[str, Any]]
    pin_code: Optional[str]
    mobile: Optional[str]
    email: Optional[str]
    pan: Optional[str]
    uid: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True

# ---------------------------------------------------------------------------
# Identification step schemas
# ---------------------------------------------------------------------------
class IdentificationCreate(BaseModel):
    id_type: str
    name_en: str
    name_mr: str
    age: Optional[int] = None
    address: Optional[Dict[str, Any]] = None
    proof_number: Optional[str] = None

class IdentificationResponse(BaseModel):
    id: str
    token_id: str
    id_type: str
    name_en: str
    name_mr: str
    age: Optional[int]
    address: Optional[Dict[str, Any]]
    proof_number: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True

# ---------------------------------------------------------------------------
# Stamp payment step schemas
# ---------------------------------------------------------------------------
class StampPaymentCreate(BaseModel):
    paid_by: str
    amount: float
    payment_date: Optional[datetime] = None
    framing_mc_no: Optional[str] = None
    framing_serial_no: Optional[str] = None
    vendor_name: Optional[str] = None

    @validator("payment_date", pre=True, always=True)
    def default_date(cls, v):
        return v or datetime.utcnow()

class StampPaymentResponse(BaseModel):
    id: str
    token_id: str
    paid_by: str
    amount: float
    payment_date: datetime
    franking_mc_no: Optional[str]
    franking_serial_no: Optional[str]
    vendor_name: Optional[str]
    created_at: datetime

    class Config:
        orm_mode = True
