from datetime import datetime
from decimal import Decimal
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field, field_validator, model_validator

from .validators import (
    validate_aadhaar_optional,
    validate_age_optional,
    validate_email_optional,
    validate_mobile_optional,
    validate_non_empty_str,
    validate_pan_optional,
    validate_pin_code,
    validate_positive_decimal,
)


# ---------------- Project Schemas ----------------

class ProjectBase(BaseModel):
    project_name: str
    developed_by: Optional[str] = None
    project_pan: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    corporation: Optional[str] = None
    gat_number: Optional[str] = None
    survey_number: Optional[str] = None
    hissa_number: Optional[str] = None
    location: Optional[str] = None
    sub_location: Optional[str] = None
    rate: Optional[Decimal] = None

    @field_validator("project_name")
    @classmethod
    def _project_name(cls, v: str) -> str:
        return validate_non_empty_str(v, "Project name")

    @field_validator("project_pan")
    @classmethod
    def _project_pan(cls, v: Optional[str]) -> Optional[str]:
        return validate_pan_optional(v)


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    project_name: Optional[str] = None
    developed_by: Optional[str] = None
    project_pan: Optional[str] = None
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    corporation: Optional[str] = None
    gat_number: Optional[str] = None
    survey_number: Optional[str] = None
    hissa_number: Optional[str] = None
    location: Optional[str] = None
    sub_location: Optional[str] = None
    rate: Optional[Decimal] = None
    is_active: Optional[bool] = None


class ProjectOut(ProjectBase):
    id: str
    created_by: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------- Scheme Schemas ----------------

class SchemeBase(BaseModel):
    project_id: str
    scheme_name: str
    article: Optional[str] = None
    document_title: Optional[str] = None
    draft_title: Optional[str] = None
    maha_rera_number: Optional[str] = None
    project_area: Optional[Decimal] = None
    project_area_unit: Optional[str] = "sq.ft"
    rera_validation_date: Optional[datetime] = None
    rate: Optional[Decimal] = None
    valuation_rule: Optional[str] = None
    scheme_number: Optional[str] = None
    description: Optional[str] = None
    total_units: Optional[int] = None
    total_area: Optional[Decimal] = None
    rate_per_sqft: Optional[Decimal] = None

    @field_validator("scheme_name")
    @classmethod
    def _scheme_name(cls, v: str) -> str:
        return validate_non_empty_str(v, "Scheme name")

    @field_validator("project_area", "total_area", "rate", "rate_per_sqft")
    @classmethod
    def _positive_areas(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        return validate_positive_decimal(v, "Value")


class SchemeCreate(SchemeBase):
    pass


class SchemeUpdate(BaseModel):
    scheme_name: Optional[str] = None
    article: Optional[str] = None
    document_title: Optional[str] = None
    draft_title: Optional[str] = None
    maha_rera_number: Optional[str] = None
    project_area: Optional[Decimal] = None
    project_area_unit: Optional[str] = None
    rera_validation_date: Optional[datetime] = None
    rate: Optional[Decimal] = None
    valuation_rule: Optional[str] = None
    description: Optional[str] = None
    total_units: Optional[int] = None
    total_area: Optional[Decimal] = None
    rate_per_sqft: Optional[Decimal] = None


class SchemeOut(SchemeBase):
    id: str
    status: str
    jdr_remark: Optional[str] = None
    created_by: str
    created_at: datetime
    updated_at: datetime
    project_name: Optional[str] = None

    class Config:
        from_attributes = True


class SchemeListResponse(BaseModel):
    items: List[SchemeOut]
    total: int
    page: int
    page_size: int


# ---------------- Seller Party Schemas ----------------

class SellerPartyBase(BaseModel):
    party_category: str  # Company, Partnership, Individual, Power of Attorney, Community Base Organization, Licensor, Builder/Purchaser
    party_name: str
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    pincode: Optional[str] = None
    company_name: Optional[str] = None
    registration_number: Optional[str] = None
    poa_holder_name: Optional[str] = None
    poa_document_number: Optional[str] = None
    poa_date: Optional[datetime] = None

    @field_validator("party_category", "party_name")
    @classmethod
    def _required_text(cls, v: str) -> str:
        return validate_non_empty_str(v, "Field")

    @field_validator("pan_number")
    @classmethod
    def _pan(cls, v: Optional[str]) -> Optional[str]:
        return validate_pan_optional(v)

    @field_validator("aadhaar_number")
    @classmethod
    def _aadhaar(cls, v: Optional[str]) -> Optional[str]:
        return validate_aadhaar_optional(v)

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v: Optional[str]) -> Optional[str]:
        return validate_mobile_optional(v)

    @field_validator("email")
    @classmethod
    def _email(cls, v: Optional[str]) -> Optional[str]:
        return validate_email_optional(v)

    @field_validator("pincode")
    @classmethod
    def _pincode(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return validate_pin_code(str(v))

    @model_validator(mode="after")
    def _category_rules(self):
        if self.party_category == "Company" and not (self.company_name and self.company_name.strip()):
            raise ValueError("Company name is required for Company category")
        if self.party_category == "Power of Attorney":
            if not (self.poa_holder_name and self.poa_holder_name.strip()):
                raise ValueError("POA holder name is required for Power of Attorney category")
            if not (self.poa_document_number and self.poa_document_number.strip()):
                raise ValueError("POA document number is required for Power of Attorney category")
        return self


class SellerPartyCreate(SellerPartyBase):
    pass


class SellerPartyUpdate(SellerPartyBase):
    pass


class SellerPartyOut(SellerPartyBase):
    id: str
    scheme_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------- Scheme Identifier Schemas ----------------

class SchemeIdentifierBase(BaseModel):
    identifier_type: Optional[str] = "Identifier / Witness"
    name: str
    age: Optional[int] = None
    gender: Optional[str] = None
    mobile_number: Optional[str] = None
    email: Optional[str] = None
    pan_number: Optional[str] = None
    aadhaar_number: Optional[str] = None
    address: Optional[str] = None
    state: Optional[str] = "Maharashtra"
    district: Optional[str] = None
    taluka: Optional[str] = None
    village: Optional[str] = None
    pincode: Optional[str] = None
    occupation: Optional[str] = None

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return validate_non_empty_str(v, "Identifier name")

    @field_validator("age")
    @classmethod
    def _age(cls, v: Optional[int]) -> Optional[int]:
        return validate_age_optional(v)

    @field_validator("pan_number")
    @classmethod
    def _pan(cls, v: Optional[str]) -> Optional[str]:
        return validate_pan_optional(v)

    @field_validator("aadhaar_number")
    @classmethod
    def _aadhaar(cls, v: Optional[str]) -> Optional[str]:
        return validate_aadhaar_optional(v)

    @field_validator("mobile_number")
    @classmethod
    def _mobile(cls, v: Optional[str]) -> Optional[str]:
        return validate_mobile_optional(v)

    @field_validator("email")
    @classmethod
    def _email(cls, v: Optional[str]) -> Optional[str]:
        return validate_email_optional(v)

    @field_validator("pincode")
    @classmethod
    def _pincode(cls, v: Optional[str]) -> Optional[str]:
        if v is None or not str(v).strip():
            return None
        return validate_pin_code(str(v))

    @model_validator(mode="after")
    def _address_required(self):
        if not (self.address and self.address.strip()):
            raise ValueError("Address is required")
        return self


class SchemeIdentifierCreate(SchemeIdentifierBase):
    pass


class SchemeIdentifierUpdate(SchemeIdentifierBase):
    pass


class SchemeIdentifierOut(SchemeIdentifierBase):
    id: str
    scheme_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------- Scheme Document Schemas ----------------

class SchemeDocumentOut(BaseModel):
    id: str
    scheme_id: str
    document_type: str
    document_name: str
    mime_type: str
    file_size: int
    version: int
    is_active: bool
    uploaded_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ---------------- Template Schemas ----------------

class TemplateBase(BaseModel):
    template_name: str
    template_code: Optional[str] = None
    description: Optional[str] = None
    template_content: Optional[str] = None
    field_groups: Optional[List[Any]] = None

    @field_validator("template_name")
    @classmethod
    def _template_name(cls, v: str) -> str:
        return validate_non_empty_str(v, "Template name")


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(BaseModel):
    template_name: Optional[str] = None
    template_code: Optional[str] = None
    description: Optional[str] = None
    template_content: Optional[str] = None
    field_groups: Optional[List[Any]] = None
    status: Optional[str] = None


class TemplateOut(TemplateBase):
    id: str
    scheme_id: str
    status: str
    created_by: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TemplatePreviewRequest(BaseModel):
    template_content: Optional[str] = None
    sample_data: Optional[Dict[str, Any]] = None


class TemplatePreviewResponse(BaseModel):
    rendered_html: str
    tokens_replaced: List[str]
    missing_tokens: List[str]


# ---------------- Submission & Status Schemas ----------------

class SchemeSubmitCheckResponse(BaseModel):
    can_submit: bool
    has_seller_parties: bool
    seller_parties_count: int
    has_identifier: bool
    has_mandatory_documents: bool
    documents_count: int
    has_templates: bool
    templates_count: int
    errors: List[str]


class SchemeStatusResponse(BaseModel):
    scheme_id: str
    status: str
    message: str
