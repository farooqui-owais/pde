"""eKYC verification endpoints.

Security: the raw identifier (e.g. Aadhaar) submitted in the create payload
is used only to derive a masked display value (last 4 characters) — it is
never written to the database and never returned in any response. Actual
provider integration (UIDAI/DigiLocker/etc.) is TBD; `verify` here only
records/updates verification *state* against a provider reference id that
the frontend/provider SDK supplies.
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, models_verification, schemas_verification
from ..database import get_db
from ..security import get_current_user

router = APIRouter(prefix="/api/v1/document-entries", tags=["ekyc-verifications"])


def _entry_or_404(db: Session, entry_id: str, user: models.User) -> models.DocumentEntry:
    entry = (
        db.query(models.DocumentEntry)
        .filter(models.DocumentEntry.id == entry_id, models.DocumentEntry.user_id == user.id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Document entry not found")
    return entry


def _mask(identifier: str | None) -> str | None:
    if not identifier:
        return None
    digits = "".join(ch for ch in identifier if ch.isalnum())
    if len(digits) <= 4:
        return "X" * len(digits)
    return "X" * (len(digits) - 4) + digits[-4:]


@router.post(
    "/{entry_id}/ekyc-verifications",
    response_model=schemas_verification.EkycVerificationOut,
    status_code=201,
)
def start_ekyc_verification(
    entry_id: str,
    payload: schemas_verification.EkycVerificationCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)

    verification = models_verification.EkycVerification(
        document_entry_id=entry.id,
        party_id=payload.party_id,
        provider=payload.provider,
        verification_type=payload.verification_type,
        masked_identifier=_mask(payload.identifier),
        status="PENDING",
    )
    db.add(verification)
    db.commit()
    db.refresh(verification)
    return verification


@router.get(
    "/{entry_id}/ekyc-verifications",
    response_model=List[schemas_verification.EkycVerificationOut],
)
def list_ekyc_verifications(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    return (
        db.query(models_verification.EkycVerification)
        .filter(models_verification.EkycVerification.document_entry_id == entry.id)
        .order_by(models_verification.EkycVerification.created_at)
        .all()
    )


@router.put(
    "/ekyc-verifications/{verification_id}/status",
    response_model=schemas_verification.EkycVerificationOut,
)
def update_ekyc_status(
    verification_id: str,
    payload: schemas_verification.EkycVerificationStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Record the outcome reported back by the eKYC provider/SDK.

    The backend is the authority on stored status; the frontend must not
    infer "verified" purely from a client-side redirect.
    """
    verification = (
        db.query(models_verification.EkycVerification)
        .join(models.DocumentEntry)
        .filter(
            models_verification.EkycVerification.id == verification_id,
            models.DocumentEntry.user_id == current_user.id,
        )
        .first()
    )
    if not verification:
        raise HTTPException(status_code=404, detail="eKYC verification not found")

    from datetime import datetime

    verification.status = payload.status
    if payload.reference_id is not None:
        verification.reference_id = payload.reference_id
    if payload.provider_response_summary is not None:
        verification.provider_response_summary = payload.provider_response_summary
    if payload.status == "VERIFIED":
        verification.verified_at = datetime.utcnow()

    db.commit()
    db.refresh(verification)
    return verification
