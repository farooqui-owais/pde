"""Execution-capture endpoints (photo / fingerprint / signature-pad capture
at the SRO counter). Additive — mirrors the ownership-check pattern already
used in entry_details.py / stamp.py so it composes with the existing
document_entries workflow without touching it.

The manual does not describe this step; scope is intentionally minimal
until authoritative device/vendor requirements are supplied (see
models_verification.py docstring).
"""
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models, models_verification, schemas_verification
from ..database import get_db
from ..security import get_current_user

router = APIRouter(prefix="/api/v1/document-entries", tags=["execution-captures"])


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
    "/{entry_id}/execution-captures",
    response_model=schemas_verification.ExecutionCaptureOut,
    status_code=201,
)
def add_execution_capture(
    entry_id: str,
    payload: schemas_verification.ExecutionCaptureCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)

    capture = models_verification.ExecutionCapture(
        document_entry_id=entry.id,
        party_id=payload.party_id,
        capture_type=payload.capture_type,
        storage_key=payload.storage_key,
        device_reference=payload.device_reference,
        extra_metadata=payload.extra_metadata,
        captured_by=current_user.id,
    )
    db.add(capture)
    db.commit()
    db.refresh(capture)
    return capture


@router.get(
    "/{entry_id}/execution-captures",
    response_model=List[schemas_verification.ExecutionCaptureOut],
)
def list_execution_captures(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    return (
        db.query(models_verification.ExecutionCapture)
        .filter(models_verification.ExecutionCapture.document_entry_id == entry.id)
        .order_by(models_verification.ExecutionCapture.captured_at)
        .all()
    )


@router.put(
    "/execution-captures/{capture_id}",
    response_model=schemas_verification.ExecutionCaptureOut,
)
def update_execution_capture(
    capture_id: str,
    payload: schemas_verification.ExecutionCaptureUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    capture = (
        db.query(models_verification.ExecutionCapture)
        .join(models.DocumentEntry)
        .filter(
            models_verification.ExecutionCapture.id == capture_id,
            models.DocumentEntry.user_id == current_user.id,
        )
        .first()
    )
    if not capture:
        raise HTTPException(status_code=404, detail="Execution capture not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(capture, field, value)

    db.commit()
    db.refresh(capture)
    return capture


@router.delete("/execution-captures/{capture_id}", status_code=204)
def delete_execution_capture(
    capture_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    capture = (
        db.query(models_verification.ExecutionCapture)
        .join(models.DocumentEntry)
        .filter(
            models_verification.ExecutionCapture.id == capture_id,
            models.DocumentEntry.user_id == current_user.id,
        )
        .first()
    )
    if not capture:
        raise HTTPException(status_code=404, detail="Execution capture not found")
    db.delete(capture)
    db.commit()
    return None
