"""Property / Party / Identification steps, PUI & PAN verification stubs,
the Public Data Entry Report, and the final Confirmation screen.

These are additive to the existing `/api/documents` (Presentation Step1),
`/api/stamp` (Rent Terms + Stamp Payment) routes and do not touch
login/registration logic. Modeled on the iSarita Public Data Entry manual:
Property Details / Party Details / Identification Details are each
repeatable (multiple rows per entry), and the flow ends with an
auto-generated report followed by a confirmation screen listing the
concurrent-jurisdiction SRO offices the citizen may visit.
"""
import json
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..entry_validation import validate_entry_ready_for_completion
from ..security import get_current_user

router = APIRouter(prefix="/api/documents", tags=["entry-details"])


def _entry_or_404(db: Session, entry_id: str, user: models.User) -> models.DocumentEntry:
    entry = (
        db.query(models.DocumentEntry)
        .filter(models.DocumentEntry.id == entry_id, models.DocumentEntry.user_id == user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Document entry not found")
    return entry


# ---------------------------------------------------------------------------
# Property Details (repeatable)
# ---------------------------------------------------------------------------

def _attrs_to_json(attrs) -> str:
    cleaned = [a.model_dump() if hasattr(a, "model_dump") else a for a in attrs]
    return json.dumps(cleaned)


def _property_out(p: models.PropertyDetail) -> schemas.PropertyDetailOut:
    raw_attrs = json.loads(p.attributes or "[]")
    parsed_attrs = [schemas.PropertyAttribute(**a) for a in raw_attrs]
    return schemas.PropertyDetailOut(
        id=p.id,
        document_entry_id=p.document_entry_id,
        district=p.district,
        village_name=p.village_name,
        urban_rural=p.urban_rural,
        hadd_type=p.hadd_type,
        hadd_name=p.hadd_name,
        taluka=p.taluka,
        zp=p.zp,
        attributes=parsed_attrs,
        area=p.area,
        area_unit=p.area_unit,
        property_type=p.property_type,
        pui_number=p.pui_number,
        pui_verified=p.pui_verified,
        address_type=p.address_type,
        flat_no_en=p.flat_no_en,
        flat_no_mr=p.flat_no_mr,
        floor_no_en=p.floor_no_en,
        floor_no_mr=p.floor_no_mr,
        building_name_en=p.building_name_en,
        building_name_mr=p.building_name_mr,
        block_sector_en=p.block_sector_en,
        block_sector_mr=p.block_sector_mr,
        road_en=p.road_en,
        road_mr=p.road_mr,
        other_desc=p.other_desc,
        eother_desc=p.eother_desc,
        potkharaba_area=p.potkharaba_area,
        other_right_mr=p.other_right_mr,
        other_right_en=p.other_right_en,
    )


@router.post("/{entry_id}/properties", response_model=schemas.PropertyDetailOut, status_code=201)
def add_property(
    entry_id: str,
    payload: schemas.PropertyDetailCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)

    data = payload.model_dump()
    attrs = data.pop("attributes", [])
    record = models.PropertyDetail(
        document_entry_id=entry_id,
        attributes=_attrs_to_json(attrs),
        **data,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return _property_out(record)


@router.get("/{entry_id}/properties", response_model=List[schemas.PropertyDetailOut])
def list_properties(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    return [_property_out(p) for p in entry.properties]


@router.delete("/{entry_id}/properties/{property_id}", status_code=204)
def delete_property(
    entry_id: str,
    property_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    record = (
        db.query(models.PropertyDetail)
        .filter(models.PropertyDetail.id == property_id, models.PropertyDetail.document_entry_id == entry_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Property not found")
    db.delete(record)
    db.commit()
    return None


@router.post("/{entry_id}/verify-pui", response_model=schemas.PuiVerifyResponse)
def verify_pui(
    entry_id: str,
    payload: schemas.PuiVerifyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Placeholder PUI / Property Tax No. verification. The real iSarita PDE
    calls an external property-tax service — this stub just checks the
    number is non-empty and echoes it back so the UI flow is testable."""
    _entry_or_404(db, entry_id, current_user)
    verified = bool(payload.pui_number and payload.pui_number.strip())
    return schemas.PuiVerifyResponse(pui_number=payload.pui_number, verified=verified)


# ---------------------------------------------------------------------------
# Party Details (repeatable)
# ---------------------------------------------------------------------------

def _format_party_out(party: models.PartyDetail) -> schemas.PartyDetailOut:
    addr_parts = [
        party.flat_no_en or party.flat_no_mr,
        party.floor_no_en or party.floor_no_mr,
        party.building_name_en or party.building_name_mr,
        party.block_sector_en or party.block_sector_mr,
        party.road_en or party.road_mr,
        party.city_en or party.city_mr,
        party.district_name,
        party.pin_code,
    ]
    address_combined = ", ".join([p for p in addr_parts if p]) or "—"
    out = schemas.PartyDetailOut.model_validate(party)
    out.address_combined = address_combined
    return out


@router.post("/{entry_id}/parties", response_model=schemas.PartyDetailOut, status_code=201)
def add_party(
    entry_id: str,
    payload: schemas.PartyDetailCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    record = models.PartyDetail(document_entry_id=entry_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return _format_party_out(record)


@router.put("/{entry_id}/parties/{party_id}", response_model=schemas.PartyDetailOut)
def update_party(
    entry_id: str,
    party_id: str,
    payload: schemas.PartyDetailCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    record = (
        db.query(models.PartyDetail)
        .filter(models.PartyDetail.id == party_id, models.PartyDetail.document_entry_id == entry_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Party not found")
    for key, value in payload.model_dump().items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return _format_party_out(record)


@router.get("/{entry_id}/parties", response_model=List[schemas.PartyDetailOut])
def list_parties(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    return [_format_party_out(p) for p in entry.parties]


@router.delete("/{entry_id}/parties/{party_id}", status_code=204)
def delete_party(
    entry_id: str,
    party_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    record = (
        db.query(models.PartyDetail)
        .filter(models.PartyDetail.id == party_id, models.PartyDetail.document_entry_id == entry_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Party not found")
    db.delete(record)
    db.commit()
    return None


@router.post("/{entry_id}/parties/{party_id}/verify-mobile")
def verify_mobile(
    entry_id: str,
    party_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    party = (
        db.query(models.PartyDetail)
        .filter(models.PartyDetail.id == party_id, models.PartyDetail.document_entry_id == entry_id)
        .first()
    )
    if not party:
        raise HTTPException(status_code=404, detail="Party not found")
    party.mobile_number_verified = True
    db.commit()
    return {"verified": True, "mobile_number": party.mobile_number}


@router.post("/{entry_id}/verify-pan", response_model=schemas.PanVerifyResponse)
def verify_pan(
    entry_id: str,
    payload: schemas.PanVerifyRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Placeholder PAN verification. Real iSarita PDE calls the Income Tax
    PAN verification service — this stub only checks the 10-char PAN
    pattern (5 letters, 4 digits, 1 letter) so the UI flow is testable."""
    _entry_or_404(db, entry_id, current_user)
    import re
    verified = bool(re.match(r"^[A-Z]{5}[0-9]{4}[A-Z]$", (payload.pan_number or "").upper()))
    return schemas.PanVerifyResponse(pan_number=payload.pan_number, verified=verified)


# ---------------------------------------------------------------------------
# Identification Details (repeatable)
# ---------------------------------------------------------------------------

@router.post("/{entry_id}/identifications", response_model=schemas.IdentificationDetailOut, status_code=201)
def add_identification(
    entry_id: str,
    payload: schemas.IdentificationDetailCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    record = models.IdentificationDetail(document_entry_id=entry_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{entry_id}/identifications/{identification_id}", response_model=schemas.IdentificationDetailOut)
def update_identification(
    entry_id: str,
    identification_id: str,
    payload: schemas.IdentificationDetailCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    record = (
        db.query(models.IdentificationDetail)
        .filter(
            models.IdentificationDetail.id == identification_id,
            models.IdentificationDetail.document_entry_id == entry_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Identification not found")
    for key, value in payload.model_dump().items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{entry_id}/identifications", response_model=List[schemas.IdentificationDetailOut])
def list_identifications(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    return entry.identifications


@router.delete("/{entry_id}/identifications/{identification_id}", status_code=204)
def delete_identification(
    entry_id: str,
    identification_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    record = (
        db.query(models.IdentificationDetail)
        .filter(
            models.IdentificationDetail.id == identification_id,
            models.IdentificationDetail.document_entry_id == entry_id,
        )
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Identification not found")
    db.delete(record)
    db.commit()
    return None


# ---------------------------------------------------------------------------
# Public Data Entry Report (13-field bilingual summary, per manual)
# ---------------------------------------------------------------------------

@router.get("/{entry_id}/report", response_model=schemas.PublicDataEntryReportOut)
def get_report(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    token = entry.token

    survey_cts = []
    tenure_bits = []
    total_area = None
    village = None
    for p in entry.properties:
        village = village or p.village_name
        for attr in json.loads(p.attributes or "[]"):
            survey_cts.append(f"{attr.get('type')}: {attr.get('value')}")
        if p.hadd_type:
            tenure_bits.append(p.hadd_type)
        if p.area:
            total_area = (total_area or 0) + float(p.area)

    def _party_dict(pt: models.PartyDetail) -> dict:
        return {
            "name": f"{pt.first_name_en or ''} {pt.surname_en or ''}".strip(),
            "age": pt.age,
            "address": f"{pt.flat_no_en or ''} {pt.building_name_en or ''} {pt.road_en or ''}".strip(),
            "mobile": pt.mobile_number,
            "uid": pt.uid,
            "pan": pt.pan_number,
        }

    executants = [_party_dict(p) for p in entry.parties if p.is_presentor or p.is_stamp_purchaser]
    claimants = [_party_dict(p) for p in entry.parties if not (p.is_presentor or p.is_stamp_purchaser)]
    witnesses = [
        {
            "name": f"{i.first_name_en or ''} {i.surname_en or ''}".strip(),
            "age": i.age,
            "address": i.address_en,
            "proof": f"{i.identification_proof or ''} {i.proof_number or ''}".strip(),
        }
        for i in entry.identifications
    ]

    return schemas.PublicDataEntryReportOut(
        token_number=token.token_number,
        document_type=entry.document_title,
        consideration_amount=entry.consideration_amount,
        market_value=entry.market_value,
        required_stamp_duty=entry.stamp_duty,
        date_of_execution=entry.date_of_execution,
        village_name=village,
        number_of_pages=entry.number_of_pages,
        survey_cts_numbers=survey_cts,
        tenure_and_area=", ".join(tenure_bits) if tenure_bits else None,
        area=total_area,
        executants=executants,
        claimants=claimants,
        witnesses=witnesses,
    )


# ---------------------------------------------------------------------------
# Confirmation — final screen listing concurrent-jurisdiction SRO offices
# ---------------------------------------------------------------------------

@router.post("/{entry_id}/complete", response_model=schemas.ConfirmationOut)
def complete_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    validate_entry_ready_for_completion(entry)
    entry.status = "SUBMITTED"
    token = entry.token
    if token:
        token.status = "SUBMITTED"
    db.commit()
    offices: List[models.RegistrationOffice] = []
    if token and token.district_id:
        offices = (
            db.query(models.RegistrationOffice)
            .filter(models.RegistrationOffice.district_id == token.district_id)
            .order_by(models.RegistrationOffice.name)
            .all()
        )

    return schemas.ConfirmationOut(
        token_number=token.token_number if token else "",
        status=entry.status,
        concurrent_offices=[schemas.ConcurrentOfficeOut(id=o.id, name=o.name) for o in offices],
    )