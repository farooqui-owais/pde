from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, models_scheme, schemas_scheme
from ..security import get_current_user

router = APIRouter(prefix="/api/v1/schemes", tags=["scheme-identifier"])


def _scheme_or_404(db: Session, scheme_id: str, current_user: models.User) -> models_scheme.Scheme:
    scheme = (
        db.query(models_scheme.Scheme)
        .filter(
            models_scheme.Scheme.id == scheme_id,
            models_scheme.Scheme.created_by == current_user.id,
        )
        .first()
    )
    if not scheme:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scheme not found")
    return scheme


@router.get("/{scheme_id}/identifier", response_model=schemas_scheme.SchemeIdentifierOut)
def get_scheme_identifier(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)
    if not scheme.identifier:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Identifier not found for scheme")
    return scheme.identifier


@router.post("/{scheme_id}/identifier", response_model=schemas_scheme.SchemeIdentifierOut, status_code=status.HTTP_201_CREATED)
def create_or_update_scheme_identifier(
    scheme_id: str,
    payload: schemas_scheme.SchemeIdentifierCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)

    identifier = scheme.identifier
    if identifier:
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(identifier, field, value)
    else:
        identifier = models_scheme.SchemeIdentifier(
            scheme_id=scheme.id,
            identifier_type=payload.identifier_type or "Identifier / Witness",
            name=payload.name,
            age=payload.age,
            gender=payload.gender,
            mobile_number=payload.mobile_number,
            email=payload.email,
            pan_number=payload.pan_number,
            aadhaar_number=payload.aadhaar_number,
            address=payload.address,
            state=payload.state or "Maharashtra",
            district=payload.district,
            taluka=payload.taluka,
            village=payload.village,
            pincode=payload.pincode,
            occupation=payload.occupation,
        )
        db.add(identifier)

    db.commit()
    db.refresh(identifier)
    return identifier


@router.put("/{scheme_id}/identifier", response_model=schemas_scheme.SchemeIdentifierOut)
def update_scheme_identifier(
    scheme_id: str,
    payload: schemas_scheme.SchemeIdentifierUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    return create_or_update_scheme_identifier(scheme_id, payload, db, current_user)
