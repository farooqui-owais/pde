import json
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user

router = APIRouter(prefix="/api/stamp", tags=["stamp"])


def _entry_or_404(db: Session, entry_id: str, user: models.User) -> models.DocumentEntry:
    entry = (
        db.query(models.DocumentEntry)
        .filter(models.DocumentEntry.id == entry_id, models.DocumentEntry.user_id == user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Document entry not found")
    return entry


# ---------- Rent & Other Terms (Presentation Step2) ----------

@router.post("/rent-terms", response_model=schemas.RentTermOut, status_code=201)
def save_rent_terms(
    payload: schemas.RentTermCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, payload.document_entry_id, current_user)

    existing = (
        db.query(models.RentTerm)
        .filter(models.RentTerm.document_entry_id == payload.document_entry_id)
        .first()
    )
    slabs_json = json.dumps([s.model_dump() for s in payload.rent_slabs], default=str)

    if existing:
        existing.license_period_months = payload.license_period_months
        existing.from_date = payload.from_date
        existing.to_date = payload.to_date
        existing.percent_increment_yearly = payload.percent_increment_yearly
        existing.property_use = payload.property_use
        existing.refundable_deposit = payload.refundable_deposit
        existing.non_refundable_deposit = payload.non_refundable_deposit
        existing.rent_slabs = slabs_json
        record = existing
    else:
        record = models.RentTerm(
            document_entry_id=payload.document_entry_id,
            license_period_months=payload.license_period_months,
            from_date=payload.from_date,
            to_date=payload.to_date,
            percent_increment_yearly=payload.percent_increment_yearly,
            property_use=payload.property_use,
            refundable_deposit=payload.refundable_deposit,
            non_refundable_deposit=payload.non_refundable_deposit,
            rent_slabs=slabs_json,
        )
        db.add(record)

    db.commit()
    db.refresh(record)
    return schemas.RentTermOut(
        id=record.id,
        document_entry_id=record.document_entry_id,
        license_period_months=record.license_period_months,
        from_date=record.from_date,
        to_date=record.to_date,
        percent_increment_yearly=record.percent_increment_yearly,
        property_use=record.property_use,
        refundable_deposit=record.refundable_deposit,
        non_refundable_deposit=record.non_refundable_deposit,
        rent_slabs=json.loads(record.rent_slabs or "[]"),
    )


@router.get("/rent-terms/{document_entry_id}", response_model=schemas.RentTermOut)
def get_rent_terms(
    document_entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, document_entry_id, current_user)
    record = (
        db.query(models.RentTerm)
        .filter(models.RentTerm.document_entry_id == document_entry_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="No rent terms saved yet")
    return schemas.RentTermOut(
        id=record.id,
        document_entry_id=record.document_entry_id,
        license_period_months=record.license_period_months,
        from_date=record.from_date,
        to_date=record.to_date,
        percent_increment_yearly=record.percent_increment_yearly,
        property_use=record.property_use,
        refundable_deposit=record.refundable_deposit,
        non_refundable_deposit=record.non_refundable_deposit,
        rent_slabs=json.loads(record.rent_slabs or "[]"),
    )


# ---------- Details of Stamp Payment ----------

@router.post("/payments", response_model=schemas.StampPaymentOut, status_code=201)
def add_stamp_payment(
    payload: schemas.StampPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, payload.document_entry_id, current_user)
    record = models.StampPaymentDetail(**payload.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/payments/{document_entry_id}", response_model=List[schemas.StampPaymentOut])
def list_stamp_payments(
    document_entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, document_entry_id, current_user)
    return (
        db.query(models.StampPaymentDetail)
        .filter(models.StampPaymentDetail.document_entry_id == document_entry_id)
        .order_by(models.StampPaymentDetail.created_at.desc())
        .all()
    )


@router.delete("/payments/{payment_id}", status_code=204)
def delete_stamp_payment(
    payment_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    record = (
        db.query(models.StampPaymentDetail)
        .join(models.DocumentEntry)
        .filter(models.StampPaymentDetail.id == payment_id, models.DocumentEntry.user_id == current_user.id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="Payment record not found")
    db.delete(record)
    db.commit()
    return None


# ---------- Advanced Stamp Duty Calculate (clause tree) ----------

# Simplified illustrative clause tree mirroring the reference "Conveyance"
# breakdown. Rates are placeholders — verify the official Maharashtra
# Stamp Act schedule before relying on this for anything real.
CLAUSE_TREE = {
    "id": "conveyance",
    "label": "Conveyance",
    "children": [
        {"id": "25-a", "label": "(25-a) Movable Property", "rate_percent": Decimal("3")},
        {
            "id": "25-b",
            "label": "(25-b) Immovable Property",
            "children": [
                {"id": "25-b-i", "label": "Within limits of any Municipal Corporation or Cantonment area", "rate_percent": Decimal("5")},
                {"id": "25-b-ii", "label": "Within limits of Municipal Council / Nagarpanchayat / MMRDA / other urban area", "rate_percent": Decimal("4")},
                {"id": "25-b-iii", "label": "Within limits of any Grampanchayat area or area not mentioned above", "rate_percent": Decimal("3")},
            ],
        },
        {
            "id": "25-c",
            "label": "(25-c) If relating to both movable and immovable property",
            "children": [
                {"id": "25-c-i", "label": "Within limits of any Municipal Corporation or Cantonment area", "rate_percent": Decimal("5")},
                {"id": "25-c-ii", "label": "Within limits of Municipal Council / Nagarpanchayat / MMRDA / other urban area", "rate_percent": Decimal("4")},
                {"id": "25-c-iii", "label": "Within limits of any Grampanchayat area or area not mentioned above", "rate_percent": Decimal("3")},
            ],
        },
    ],
}


def _find_clause(node, clause_id):
    if node["id"] == clause_id:
        return node
    for child in node.get("children", []):
        found = _find_clause(child, clause_id)
        if found:
            return found
    return None


@router.get("/clause-tree")
def get_clause_tree():
    return CLAUSE_TREE


@router.post("/calculate-advanced", response_model=schemas.StampDutyAdvancedResponse)
def calculate_advanced(payload: schemas.StampDutyAdvancedRequest):
    clause = _find_clause(CLAUSE_TREE, payload.clause_id)
    if not clause or "rate_percent" not in clause:
        raise HTTPException(status_code=400, detail="Select a leaf clause with a rate")

    base = max(payload.market_value, payload.consideration_amount)
    rate = clause["rate_percent"]
    if payload.is_investor_clause:
        rate += Decimal("1")

    actual_duty = (base * rate / Decimal("100")).quantize(Decimal("1.00"))
    surcharge = (
        actual_duty
        * (payload.surcharge_percent + payload.metro_cess_percent + payload.railway_cess_percent)
        / Decimal("100")
    ).quantize(Decimal("1.00"))
    total = actual_duty + surcharge

    return schemas.StampDutyAdvancedResponse(
        actual_stamp_duty=actual_duty, surcharge=surcharge, total_stamp_duty=total
    )
