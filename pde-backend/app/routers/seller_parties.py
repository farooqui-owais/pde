from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, models_scheme, schemas_scheme
from ..security import get_current_user

router = APIRouter(tags=["seller-parties"])


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


@router.get("/api/v1/schemes/{scheme_id}/seller-parties", response_model=List[schemas_scheme.SellerPartyOut])
def list_seller_parties(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)
    return scheme.seller_parties


@router.post("/api/v1/schemes/{scheme_id}/seller-parties", response_model=schemas_scheme.SellerPartyOut, status_code=status.HTTP_201_CREATED)
def create_seller_party(
    scheme_id: str,
    payload: schemas_scheme.SellerPartyCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)

    seller = models_scheme.SellerParty(
        scheme_id=scheme.id,
        party_category=payload.party_category,
        party_name=payload.party_name,
        pan_number=payload.pan_number,
        aadhaar_number=payload.aadhaar_number,
        mobile_number=payload.mobile_number,
        email=payload.email,
        address_line1=payload.address_line1,
        address_line2=payload.address_line2,
        state=payload.state or "Maharashtra",
        district=payload.district,
        taluka=payload.taluka,
        village=payload.village,
        pincode=payload.pincode,
        company_name=payload.company_name,
        registration_number=payload.registration_number,
        poa_holder_name=payload.poa_holder_name,
        poa_document_number=payload.poa_document_number,
        poa_date=payload.poa_date,
    )
    db.add(seller)
    db.commit()
    db.refresh(seller)
    return seller


@router.get("/api/v1/seller-parties/{party_id}", response_model=schemas_scheme.SellerPartyOut)
def get_seller_party(
    party_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    seller = (
        db.query(models_scheme.SellerParty)
        .join(models_scheme.Scheme)
        .filter(
            models_scheme.SellerParty.id == party_id,
            models_scheme.Scheme.created_by == current_user.id,
        )
        .first()
    )
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller party not found")
    return seller


@router.put("/api/v1/seller-parties/{party_id}", response_model=schemas_scheme.SellerPartyOut)
def update_seller_party(
    party_id: str,
    payload: schemas_scheme.SellerPartyUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    seller = (
        db.query(models_scheme.SellerParty)
        .join(models_scheme.Scheme)
        .filter(
            models_scheme.SellerParty.id == party_id,
            models_scheme.Scheme.created_by == current_user.id,
        )
        .first()
    )
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller party not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(seller, field, value)

    db.commit()
    db.refresh(seller)
    return seller


@router.delete("/api/v1/seller-parties/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_seller_party(
    party_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    seller = (
        db.query(models_scheme.SellerParty)
        .join(models_scheme.Scheme)
        .filter(
            models_scheme.SellerParty.id == party_id,
            models_scheme.Scheme.created_by == current_user.id,
        )
        .first()
    )
    if not seller:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Seller party not found")

    db.delete(seller)
    db.commit()
    return None
