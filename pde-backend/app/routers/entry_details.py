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
    return json.dumps([a.model_dump() for a in attrs])


def _property_out(p: models.PropertyDetail) -> schemas.PropertyDetailOut:
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
        attributes=[schemas.PropertyAttribute(**a) for a in json.loads(p.attributes or "[]")],
        area=p.area,
        area_unit=p.area_unit,
        property_type=p.property_type,
        pui_number=p.pui_number,
        pui_verified=p.pui_verified,
        building_name_en=p.building_name_en,
        road_en=p.road_en,
        other_desc=p.other_desc,
    )


@router.post("/{entry_id}/properties", response_model=schemas.PropertyDetailOut, status_code=201)
def add_property(
    entry_id: str,
    payload: schemas.PropertyDetailCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    if len(payload.attributes) > 2:
        raise HTTPException(status_code=400, detail="Maximum 2 Attributes can be selected.")

    record = models.PropertyDetail(
        document_entry_id=entry_id,
        district=payload.district,
        village_name=payload.village_name,
        urban_rural=payload.urban_rural,
        hadd_type=payload.hadd_type,
        hadd_name=payload.hadd_name,
        taluka=payload.taluka,
        zp=payload.zp,
        attributes=_attrs_to_json(payload.attributes),
        area=payload.area,
        area_unit=payload.area_unit,
        property_type=payload.property_type,
        pui_number=payload.pui_number,
        address_type=payload.address_type,
        flat_no_en=payload.flat_no_en, flat_no_mr=payload.flat_no_mr,
        floor_no_en=payload.floor_no_en, floor_no_mr=payload.floor_no_mr,
        building_name_en=payload.building_name_en, building_name_mr=payload.building_name_mr,
        block_sector_en=payload.block_sector_en, block_sector_mr=payload.block_sector_mr,
        road_en=payload.road_en, road_mr=payload.road_mr,
        other_desc=payload.other_desc,
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

@router.post("/{entry_id}/parties", response_model=schemas.PartyDetailOut, status_code=201)
def add_party(
    entry_id: str,
    payload: schemas.PartyDetailCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    if not payload.pan_number and not payload.declaration_form_60_61:
        # Manual: Form 60/61 declaration is the alternative when PAN is absent.
        raise HTTPException(
            status_code=400,
            detail="Provide a PAN number, or check 'Is Declaration Attached (Form 60/61)'.",
        )
    record = models.PartyDetail(document_entry_id=entry_id, **payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/{entry_id}/parties", response_model=List[schemas.PartyDetailOut])
def list_parties(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    return entry.parties


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
    entry.status = "SUBMITTED"
    db.commit()

    token = entry.token
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
