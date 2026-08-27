from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user

router = APIRouter(prefix="/api/documents", tags=["documents"])


# Simplified illustrative slab rates - not legal/financial advice, verify against
# the official Maharashtra Dept. of Registration & Stamps notification before use.
STAMP_DUTY_RATE_PERCENT = Decimal("6.0")
REGISTRATION_FEE_RATE_PERCENT = Decimal("1.0")


@router.post("/calculate-stamp-duty", response_model=schemas.StampDutyCalcResponse)
def calculate_stamp_duty(payload: schemas.StampDutyCalcRequest):
    base = max(payload.market_value, payload.consideration_amount)
    duty = (base * STAMP_DUTY_RATE_PERCENT / Decimal("100")).quantize(Decimal("1.00"))
    return schemas.StampDutyCalcResponse(stamp_duty=duty, rate_percent=STAMP_DUTY_RATE_PERCENT)


@router.post("", response_model=schemas.DocumentEntryOut, status_code=201)
def create_entry(
    payload: schemas.DocumentEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    token = (
        db.query(models.EntryToken)
        .filter(models.EntryToken.id == payload.token_id, models.EntryToken.user_id == current_user.id)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")

    entry = models.DocumentEntry(
        token_id=token.id,
        user_id=current_user.id,
        article_type_id=payload.article_type_id,
        document_title=payload.document_title,
        date_of_execution=payload.date_of_execution,
        date_of_presentation=payload.date_of_presentation,
        market_value=payload.market_value,
        consideration_amount=payload.consideration_amount,
        number_of_pages=payload.number_of_pages,
    )

    if payload.market_value is not None and payload.consideration_amount is not None:
        base = max(payload.market_value, payload.consideration_amount)
        entry.stamp_duty = (base * STAMP_DUTY_RATE_PERCENT / Decimal("100")).quantize(Decimal("1.00"))

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.put("/{entry_id}", response_model=schemas.DocumentEntryOut)
def update_entry(
    entry_id: str,
    payload: schemas.DocumentEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = (
        db.query(models.DocumentEntry)
        .filter(models.DocumentEntry.id == entry_id, models.DocumentEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    entry.article_type_id = payload.article_type_id
    entry.document_title = payload.document_title
    entry.date_of_execution = payload.date_of_execution
    entry.date_of_presentation = payload.date_of_presentation
    entry.market_value = payload.market_value
    entry.consideration_amount = payload.consideration_amount
    entry.number_of_pages = payload.number_of_pages

    if payload.market_value is not None and payload.consideration_amount is not None:
        base = max(payload.market_value, payload.consideration_amount)
        entry.stamp_duty = (base * STAMP_DUTY_RATE_PERCENT / Decimal("100")).quantize(Decimal("1.00"))

    db.commit()
    db.refresh(entry)
    return entry


@router.get("", response_model=List[schemas.DocumentEntryOut])
def list_entries(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        db.query(models.DocumentEntry)
        .filter(models.DocumentEntry.user_id == current_user.id)
        .order_by(models.DocumentEntry.created_at.desc())
        .all()
    )


@router.get("/{entry_id}", response_model=schemas.DocumentEntryOut)
def get_entry(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = (
        db.query(models.DocumentEntry)
        .filter(models.DocumentEntry.id == entry_id, models.DocumentEntry.user_id == current_user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry
