import random
import string
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, schemas
from ..database import get_db
from ..security import get_current_user

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


def generate_token_number() -> str:
    stamp = datetime.utcnow().strftime("%y%m%d")
    suffix = "".join(random.choices(string.digits, k=5))
    return f"DN-{stamp}-{suffix}"


@router.post("", response_model=schemas.TokenEntryOut, status_code=201)
def create_token(
    payload: schemas.TokenEntryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    token = models.EntryToken(
        token_number=generate_token_number(),
        user_id=current_user.id,
        language=payload.language,
        district_id=payload.district_id,
        office_id=payload.office_id,
        presenter_name=payload.presenter_name or f"{current_user.first_name} {current_user.last_name or ''}".strip(),
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return token


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
    return q.order_by(models.EntryToken.created_at.desc()).all()


@router.get("/{token_id}", response_model=schemas.TokenEntryOut)
def get_token(
    token_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    token = (
        db.query(models.EntryToken)
        .filter(models.EntryToken.id == token_id, models.EntryToken.user_id == current_user.id)
        .first()
    )
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    return token
