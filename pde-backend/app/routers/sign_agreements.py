"""Agreement-signing endpoints. Signing method (e-sign / wet-ink upload) is
TBD — the manual does not describe this step; kept generic and additive,
mirroring entry_details.py's ownership-check pattern.
"""
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, models_verification, schemas_verification
from ..database import get_db
from ..security import get_current_user

router = APIRouter(prefix="/api/v1/document-entries", tags=["sign-agreements"])


def _entry_or_404(db: Session, entry_id: str, user: models.User) -> models.DocumentEntry:
    entry = (
        db.query(models.DocumentEntry)
        .filter(models.DocumentEntry.id == entry_id, models.DocumentEntry.user_id == user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Document entry not found")
    return entry


@router.post(
    "/{entry_id}/sign-agreements",
    response_model=schemas_verification.SignAgreementOut,
    status_code=201,
)
def create_sign_agreement(
    entry_id: str,
    payload: schemas_verification.SignAgreementCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)

    agreement = models_verification.SignAgreement(
        document_entry_id=entry.id,
        party_id=payload.party_id,
        method=payload.method,
        status="PENDING",
    )
    db.add(agreement)
    db.commit()
    db.refresh(agreement)
    return agreement


@router.get(
    "/{entry_id}/sign-agreements",
    response_model=List[schemas_verification.SignAgreementOut],
)
def list_sign_agreements(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    return (
        db.query(models_verification.SignAgreement)
        .filter(models_verification.SignAgreement.document_entry_id == entry.id)
        .order_by(models_verification.SignAgreement.created_at)
        .all()
    )


@router.put(
    "/sign-agreements/{agreement_id}/status",
    response_model=schemas_verification.SignAgreementOut,
)
def update_sign_agreement_status(
    agreement_id: str,
    payload: schemas_verification.SignAgreementStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    agreement = (
        db.query(models_verification.SignAgreement)
        .join(models.DocumentEntry)
        .filter(
            models_verification.SignAgreement.id == agreement_id,
            models.DocumentEntry.user_id == current_user.id,
        )
        .first()
    )
    if not agreement:
        raise HTTPException(status_code=404, detail="Sign agreement not found")

    agreement.status = payload.status
    if payload.signature_storage_key is not None:
        agreement.signature_storage_key = payload.signature_storage_key
    if payload.status == "SIGNED":
        agreement.signed_at = datetime.utcnow()

    db.commit()
    db.refresh(agreement)
    return agreement
