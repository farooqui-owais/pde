import random
import string
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import create_access_token, get_current_user, hash_password, verify_password

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


def generate_token_number(db: Session) -> str:
    """11-digit token number as required by the iSarita PDE user manual."""
    for _ in range(25):
        number = random.choice("123456789") + "".join(random.choices(string.digits, k=10))
        exists = db.query(models.EntryToken).filter(models.EntryToken.token_number == number).first()
        if not exists:
            return number
    raise HTTPException(status_code=500, detail="Could not allocate a unique token number")


def _session_payload(user: models.User, token: models.EntryToken) -> schemas.GuestSessionOut:
    return schemas.GuestSessionOut(
        access_token=create_access_token({"sub": user.id}),
        user=user,
        token=_token_out(token),
    )


def _token_out(token: models.EntryToken) -> schemas.TokenEntryOut:
    """Builds the full row the Token Information table needs (View Token
    Details / Edit Token Details columns included) in one place, rolling up
    counts from the linked DocumentEntry rather than requiring the frontend
    to make a separate request per token just to show them."""
    entry = token.entry
    return schemas.TokenEntryOut(
        id=token.id,
        token_number=token.token_number,
        language=token.language,
        district_id=token.district_id,
        district_name=token.district.name if token.district else None,
        office_id=token.office_id,
        office_name=token.office.name if token.office else None,
        presenter_name=token.presenter_name,
        slot_booking_id=token.slot_booking_id,
        status=token.status,
        created_at=token.created_at,
        entry_id=entry.id if entry else None,
        entry_status=entry.status if entry else None,
        is_draft=bool(entry and entry.status == "DRAFT"),
        party_count=len(entry.parties) if entry else 0,
        identifier_count=len(entry.identifications) if entry else 0,
        property_count=len(entry.properties) if entry else 0,
    )


def _token_or_404(db: Session, token_id: str, user: models.User) -> models.EntryToken:
    token = (
        db.query(models.EntryToken)
        .filter(models.EntryToken.id == token_id, models.EntryToken.user_id == user.id)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    return token


@router.post("", response_model=schemas.TokenEntryOut, status_code=201)
def create_token(
    payload: schemas.TokenEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # If a slot booking was made, it must belong to this user and be booked,
    # otherwise we'd let a caller attach someone else's (or a cancelled) slot.
    if payload.slot_booking_id:
        booking = (
            db.query(models.SlotBooking)
            .filter(
                models.SlotBooking.id == payload.slot_booking_id,
                models.SlotBooking.user_id == current_user.id,
            )
            .first()
        )
        if not booking:
            raise HTTPException(status_code=400, detail="Slot booking not found or does not belong to you.")
        if booking.status != "BOOKED":
            raise HTTPException(status_code=400, detail="Slot booking is not active and cannot be used.")

    token = models.EntryToken(
        token_number=generate_token_number(db),
        user_id=current_user.id,
        language=payload.language,
        district_id=payload.district_id,
        office_id=payload.office_id,
        slot_booking_id=payload.slot_booking_id,
        presenter_name=payload.presenter_name or f"{current_user.first_name} {current_user.last_name or ''}".strip(),
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return _token_out(token)


@router.post("/guest/start", response_model=schemas.GuestSessionOut, status_code=201)
def guest_start(
    payload: schemas.GuestTokenStart,
    db: Session = Depends(get_db),
):
    """Data Entry without Login — Start Registration New Entry.

    Creates a guest user whose username is the 11-digit token number so
    Modify Old Entry can resume with token number + password.
    """
    token_number = generate_token_number(db)
    user = models.User(
        first_name=(payload.presenter_name or "Guest").split(" ")[0][:80],
        last_name=None,
        username=token_number,
        hashed_password=hash_password(payload.password),
        mobile_number="0000000000",
        email=f"guest.{token_number}@example.com",
        pin_code="000000",
        is_guest=True,
    )
    db.add(user)
    db.flush()
    token = models.EntryToken(
        token_number=token_number,
        user_id=user.id,
        language=payload.language,
        district_id=payload.district_id,
        office_id=payload.office_id,
        presenter_name=payload.presenter_name,
        access_password_hash=user.hashed_password,
    )
    db.add(token)
    db.commit()
    db.refresh(user)
    db.refresh(token)
    return _session_payload(user, token)


@router.post("/guest/resume", response_model=schemas.GuestSessionOut)
def guest_resume(
    payload: schemas.GuestTokenResume,
    db: Session = Depends(get_db),
):
    """Data Entry without Login — Modify Old Entry."""
    if not payload.token_number.isdigit() or len(payload.token_number) != 11:
        raise HTTPException(status_code=400, detail="Token number must be exactly 11 digits")
    token = (
        db.query(models.EntryToken)
        .filter(models.EntryToken.token_number == payload.token_number)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    user = token.user
    hashed = token.access_password_hash or (user.hashed_password if user else None)
    if not hashed or not verify_password(payload.password, hashed):
        raise HTTPException(status_code=401, detail="Invalid token number or password")
    return _session_payload(user, token)


@router.get("", response_model=List[schemas.TokenEntryOut])
def list_tokens(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    presenter_name: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models.EntryToken).filter(models.EntryToken.user_id == current_user.id)
    if start_date:
        q = q.filter(models.EntryToken.created_at >= start_date)
    if end_date:
        q = q.filter(models.EntryToken.created_at <= end_date)
    if presenter_name:
        q = q.filter(models.EntryToken.presenter_name.ilike(f"%{presenter_name}%"))
    tokens = q.order_by(models.EntryToken.created_at.desc()).all()
    return [_token_out(t) for t in tokens]


@router.get("/{token_id}", response_model=schemas.TokenEntryOut)
def get_token(
    token_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    token = _token_or_404(db, token_id, current_user)
    return _token_out(token)


@router.put("/{token_id}", response_model=schemas.TokenEntryOut)
def update_token(
    token_id: str,
    payload: schemas.TokenEntryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Edit Token Details. Only OPEN tokens (not yet submitted/cancelled)
    can have their language/district/office/presenter changed."""
    token = _token_or_404(db, token_id, current_user)
    if token.status != "OPEN":
        raise HTTPException(status_code=400, detail=f"Token is {token.status.lower()} and can no longer be edited.")

    token.language = payload.language
    token.district_id = payload.district_id
    token.office_id = payload.office_id
    token.presenter_name = payload.presenter_name

    db.commit()
    db.refresh(token)
    return _token_out(token)
