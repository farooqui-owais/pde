"""Valuation-rate (Ready Reckoner) master/config data.

Read endpoints are public, mirroring routers/reference.py (districts,
offices, article types) which also serve unauthenticated reference data.
Write endpoints require authentication. There is no admin/role concept in
the current User model, so write access is presently "any authenticated
user" — restricting this to an admin role is TBD and should be tightened
before production use.

This table is NOT wired into stamp.py's calculate-advanced endpoint. Doing
so would mean asserting an authoritative valuation formula that neither the
manual nor the existing code specifies — left TBD per the project's
"do not invent... legal calculation logic" rule.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, models_verification, schemas_verification
from ..database import get_db
from ..security import get_current_user

router = APIRouter(prefix="/api/v1/valuation-rates", tags=["valuation-rates"])


@router.get("", response_model=List[schemas_verification.ValuationRateOut])
def list_valuation_rates(
    district: Optional[str] = None,
    taluka: Optional[str] = None,
    village: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
):
    q = db.query(models_verification.ValuationRate)
    if district:
        q = q.filter(models_verification.ValuationRate.district == district)
    if taluka:
        q = q.filter(models_verification.ValuationRate.taluka == taluka)
    if village:
        q = q.filter(models_verification.ValuationRate.village == village)
    if active_only:
        q = q.filter(models_verification.ValuationRate.is_active.is_(True))
    return q.order_by(
        models_verification.ValuationRate.district,
        models_verification.ValuationRate.taluka,
        models_verification.ValuationRate.village,
    ).all()


@router.get("/{rate_id}", response_model=schemas_verification.ValuationRateOut)
def get_valuation_rate(rate_id: str, db: Session = Depends(get_db)):
    rate = db.query(models_verification.ValuationRate).filter(models_verification.ValuationRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Valuation rate not found")
    return rate


@router.post("", response_model=schemas_verification.ValuationRateOut, status_code=201)
def create_valuation_rate(
    payload: schemas_verification.ValuationRateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rate = models_verification.ValuationRate(
        **payload.model_dump(),
        created_by=current_user.id,
    )
    db.add(rate)
    db.commit()
    db.refresh(rate)
    return rate


@router.put("/{rate_id}", response_model=schemas_verification.ValuationRateOut)
def update_valuation_rate(
    rate_id: str,
    payload: schemas_verification.ValuationRateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rate = db.query(models_verification.ValuationRate).filter(models_verification.ValuationRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Valuation rate not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rate, field, value)

    db.commit()
    db.refresh(rate)
    return rate


@router.delete("/{rate_id}", status_code=204)
def delete_valuation_rate(
    rate_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    rate = db.query(models_verification.ValuationRate).filter(models_verification.ValuationRate.id == rate_id).first()
    if not rate:
        raise HTTPException(status_code=404, detail="Valuation rate not found")
    db.delete(rate)
    db.commit()
    return None
