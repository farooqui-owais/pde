from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user


def document_entry_out(entry: models.DocumentEntry) -> schemas.DocumentEntryOut:
    token = entry.token
    office = token.office if token else None
    district = token.district if token else None
    dig_name = (office.dig_name if office and office.dig_name else None) or (district.name if district else None)
    jdr_name = (office.jdr_name if office and office.jdr_name else None) or (district.name if district else None)
    article = entry.article_type
    return schemas.DocumentEntryOut(
        id=entry.id,
        token_id=entry.token_id,
        article_type_id=entry.article_type_id,
        document_title=entry.document_title,
        date_of_execution=entry.date_of_execution,
        date_of_presentation=entry.date_of_presentation,
        market_value=entry.market_value,
        consideration_amount=entry.consideration_amount,
        stamp_duty=entry.stamp_duty,
        stamp_duty_paid=entry.stamp_duty_paid,
        stamp_duty_difference=entry.stamp_duty_difference,
        number_of_pages=entry.number_of_pages,
        status=entry.status,
        token_number=token.token_number if token else None,
        district_name=district.name if district else None,
        office_name=office.name if office else None,
        dig_name=dig_name,
        jdr_name=jdr_name,
        article_type_name=article.name if article else None,
        article_type_description=(article.description if article and article.description else (article.name if article else None)),
        presenter_type=entry.presenter_type,
        valuation_text=entry.valuation_text,
        no_valuation_reason=entry.no_valuation_reason,
        document_executed_in=entry.document_executed_in,
    )

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
        presenter_type=payload.presenter_type,
        document_executed_in=payload.document_executed_in or "India",
    )

    if payload.market_value is not None and payload.consideration_amount is not None:
        base = max(payload.market_value, payload.consideration_amount)
        entry.stamp_duty = (base * STAMP_DUTY_RATE_PERCENT / Decimal("100")).quantize(Decimal("1.00"))

    db.add(entry)
    db.commit()
    db.refresh(entry)
    return document_entry_out(entry)


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
    entry.presenter_type = payload.presenter_type
    if payload.document_executed_in:
        entry.document_executed_in = payload.document_executed_in

    if payload.market_value is not None and payload.consideration_amount is not None:
        base = max(payload.market_value, payload.consideration_amount)
        entry.stamp_duty = (base * STAMP_DUTY_RATE_PERCENT / Decimal("100")).quantize(Decimal("1.00"))

    db.commit()
    db.refresh(entry)
    return document_entry_out(entry)


@router.get("", response_model=List[schemas.DocumentEntryOut])
def list_entries(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return (
        [document_entry_out(e) for e in (
            db.query(models.DocumentEntry)
            .filter(models.DocumentEntry.user_id == current_user.id)
            .order_by(models.DocumentEntry.created_at.desc())
            .all()
        )]
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
    return document_entry_out(entry)
