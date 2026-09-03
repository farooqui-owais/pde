"""Tests for shared validators and tightened Pydantic schemas."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    DocumentEntryCreate,
    IdentificationDetailCreate,
    PartyDetailCreate,
    PropertyDetailCreate,
    UserCreate,
)
from app.validators import validate_pan_optional, validate_mobile_required


def test_pan_valid():
    assert validate_pan_optional("abcde1234f") == "ABCDE1234F"


def test_pan_invalid():
    with pytest.raises(ValueError):
        validate_pan_optional("INVALID")


def test_mobile_valid():
    assert validate_mobile_required("9822334455") == "9822334455"


def test_mobile_invalid():
    with pytest.raises(ValueError):
        validate_mobile_required("12345")


def test_user_create_password_min_length():
    with pytest.raises(ValidationError):
        UserCreate(
            first_name="Test",
            username="testuser",
            password="short",
            mobile_number="9822334455",
            email="test@example.com",
            pin_code="411001",
        )


def test_party_requires_pan_or_declaration():
    with pytest.raises(ValidationError):
        PartyDetailCreate(
            party_type="Seller/Vendor",
            first_name_en="Raj",
            surname_en="Sharma",
            declaration_form_60_61=False,
        )


def test_property_requires_district_and_village():
    with pytest.raises(ValidationError):
        PropertyDetailCreate(district="", village_name="")


def test_witness_requires_name_age_and_proof():
    with pytest.raises(ValidationError):
        IdentificationDetailCreate(
            age=30,
            identification_proof="Aadhar Card",
            proof_number="1234",
            address_en="Pune",
        )


def test_document_entry_rejects_negative_amounts():
    with pytest.raises(ValidationError):
        DocumentEntryCreate(
            token_id="abc",
            article_type_id=1,
            market_value=-1,
            consideration_amount=100,
        )


def test_complete_rejects_incomplete_entry(client, auth_headers):
    res_tok = client.post("/api/tokens", json={"language": "Marathi"}, headers=auth_headers)
    token_id = res_tok.json()["id"]
    res_entry = client.post(
        "/api/documents",
        json={
            "token_id": token_id,
            "article_type_id": 1,
            "market_value": 500000.0,
            "consideration_amount": 500000.0,
        },
        headers=auth_headers,
    )
    entry_id = res_entry.json()["id"]

    res = client.post(f"/api/documents/{entry_id}/complete", headers=auth_headers)
    assert res.status_code == 400
    detail = res.json()["detail"]
    assert detail["message"]
    assert "property" in " ".join(detail["errors"]).lower()


def test_party_email_invalid():
    with pytest.raises(ValidationError):
        PartyDetailCreate(
            party_type="Buyer",
            first_name_en="Raj",
            surname_en="Sharma",
            pan_number="ABCDE1234F",
            email="not-an-email",
        )


def test_stamp_duty_advanced_rejects_negative_amounts():
    from app.schemas import StampDutyAdvancedRequest

    with pytest.raises(ValidationError):
        StampDutyAdvancedRequest(
            clause_id="25-a",
            market_value=-100,
            consideration_amount=100,
        )


def test_stamp_duty_calc_rejects_zero():
    from app.schemas import StampDutyCalcRequest

    with pytest.raises(ValidationError):
        StampDutyCalcRequest(market_value=0, consideration_amount=0)


def test_rent_slab_rejects_negative_rent_and_bad_months():
    from app.schemas import RentSlab

    with pytest.raises(ValidationError):
        RentSlab(from_month=1, to_month=12, rent=-5)

    with pytest.raises(ValidationError):
        RentSlab(from_month=13, to_month=1, rent=100)

    # forward date range is fine
    RentSlab(from_month=2, to_month=4, rent=100)


def test_capture_type_allowlist():
    from app.schemas_verification import ExecutionCaptureCreate

    with pytest.raises(ValidationError):
        ExecutionCaptureCreate(capture_type="FINGER")  # not in allowlist

    # lowercase is normalized to uppercase
    assert ExecutionCaptureCreate(capture_type="photo").capture_type == "PHOTO"


def test_valuation_rate_rejects_negative():
    from app.schemas_verification import ValuationRateCreate

    with pytest.raises(ValidationError):
        ValuationRateCreate(district="Pune", village="Haveli", rate_per_sqft=-1)


def test_draft_category_allowlist():
    from app.validators import validate_draft_category

    assert validate_draft_category("Digital Document (without Execution Page)") is not None
    with pytest.raises(ValueError):
        validate_draft_category("Anything Else")

