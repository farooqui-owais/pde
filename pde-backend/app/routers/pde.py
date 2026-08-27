# routers/pde.py
"""FastAPI router for the iSarita Public Data Entry (PDE) module.
All endpoints are prefixed with `/api/v1/pde` (the main app can include with a prefix if desired).
The router provides:
- Token creation / verification for the "data entry without login" flow.
- CRUD endpoints for each wizard step (presentation, property, party, identification, stamp payment).
- Report generation endpoint (HTML placeholder).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from ..database import get_db
from .. import models_pde, schemas_pde
from ..security import hash_password, verify_password

router = APIRouter(prefix="/api/v1/pde", tags=["PDE"])

# ---------------------------------------------------------------------------
# Helper dependencies
# ---------------------------------------------------------------------------

def get_token_or_404(token_number: str, db: Session = Depends(get_db)) -> models_pde.PDENetworkToken:
    token = db.query(models_pde.PDENetworkToken).filter(models_pde.PDENetworkToken.token_number == token_number).first()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")
    return token

# ---------------------------------------------------------------------------
# Token endpoints (no login required)
# ---------------------------------------------------------------------------
@router.post("/token/create", response_model=schemas_pde.TokenResponse)
def create_token(payload: schemas_pde.TokenCreate, db: Session = Depends(get_db)):
    # Ensure token number uniqueness (could be generated here, but payload provides for now)
    existing = db.query(models_pde.PDENetworkToken).filter(models_pde.PDENetworkToken.token_number == payload.token_number).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token number already exists")
    token = models_pde.PDENetworkToken(
        token_number=payload.token_number,
        password_hash=hash_password(payload.password),
        status=models_pde.PDESessionStatus.OPEN,
    )
    db.add(token)
    db.commit()
    db.refresh(token)
    return schemas_pde.TokenResponse.from_orm(token)

@router.post("/token/verify", response_model=schemas_pde.TokenVerifyResponse)
def verify_token(payload: schemas_pde.TokenVerify, db: Session = Depends(get_db)):
    token = db.query(models_pde.PDENetworkToken).filter(models_pde.PDENetworkToken.token_number == payload.token_number).first()
    if not token:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")
    if not verify_password(payload.password, token.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid password")
    return schemas_pde.TokenVerifyResponse(valid=True, status=token.status.value)

# ---------------------------------------------------------------------------
# Presentation step
# ---------------------------------------------------------------------------
@router.post("/token/{token_number}/presentation", response_model=schemas_pde.PresentationResponse)
def save_presentation(
    token_number: str,
    payload: schemas_pde.PresentationCreate,
    db: Session = Depends(get_db),
):
    token = get_token_or_404(token_number, db)
    # One‑to‑one relation – replace if exists
    if token.presentation:
        db.delete(token.presentation)
        db.flush()
    pres = models_pde.PDEStepPresentation(
        token_id=token.id,
        article=payload.article,
        document_title=payload.document_title,
        execution_date=payload.execution_date,
        market_value=payload.market_value,
        consideration=payload.consideration,
        stamp_duty=payload.stamp_duty,
        page_count=payload.page_count,
    )
    db.add(pres)
    db.commit()
    db.refresh(pres)
    return schemas_pde.PresentationResponse.from_orm(pres)

# ---------------------------------------------------------------------------
# Property step (repeatable)
# ---------------------------------------------------------------------------
@router.post("/token/{token_number}/properties", response_model=schemas_pde.PropertyResponse)
def add_property(token_number: str, payload: schemas_pde.PropertyCreate, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    prop = models_pde.PDEStepProperty(
        token_id=token.id,
        district=payload.district,
        village=payload.village,
        urban_rural=payload.urban_rural,
        hadd_type=payload.hadd_type,
        hadd_name=payload.hadd_name,
        taluka=payload.taluka,
        zp=payload.zp,
        attributes=payload.attributes,
        area=payload.area,
        area_unit=payload.area_unit,
        property_type=payload.property_type,
        pui_number=payload.pui_number,
    )
    db.add(prop)
    db.commit()
    db.refresh(prop)
    return schemas_pde.PropertyResponse.from_orm(prop)

@router.get("/token/{token_number}/properties", response_model=List[schemas_pde.PropertyResponse])
def list_properties(token_number: str, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    return [schemas_pde.PropertyResponse.from_orm(p) for p in token.properties]

# ---------------------------------------------------------------------------
# Party step (repeatable)
# ---------------------------------------------------------------------------
@router.post("/token/{token_number}/parties", response_model=schemas_pde.PartyResponse)
def add_party(token_number: str, payload: schemas_pde.PartyCreate, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    party = models_pde.PDEStepParty(
        token_id=token.id,
        party_type=payload.party_type,
        name_en=payload.name_en,
        name_mr=payload.name_mr,
        age=payload.age,
        is_bank=payload.is_bank,
        is_stamp_purchaser=payload.is_stamp_purchaser,
        is_presentor=payload.is_presentor,
        address=payload.address,
        pin_code=payload.pin_code,
        mobile=payload.mobile,
        email=payload.email,
        pan=payload.pan,
        uid=payload.uid,
    )
    db.add(party)
    db.commit()
    db.refresh(party)
    return schemas_pde.PartyResponse.from_orm(party)

@router.get("/token/{token_number}/parties", response_model=List[schemas_pde.PartyResponse])
def list_parties(token_number: str, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    return [schemas_pde.PartyResponse.from_orm(p) for p in token.parties]

# ---------------------------------------------------------------------------
# Identification step (repeatable)
# ---------------------------------------------------------------------------
@router.post("/token/{token_number}/identifications", response_model=schemas_pde.IdentificationResponse)
def add_identification(token_number: str, payload: schemas_pde.IdentificationCreate, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    ident = models_pde.PDEStepIdentification(
        token_id=token.id,
        id_type=payload.id_type,
        name_en=payload.name_en,
        name_mr=payload.name_mr,
        age=payload.age,
        address=payload.address,
        proof_number=payload.proof_number,
    )
    db.add(ident)
    db.commit()
    db.refresh(ident)
    return schemas_pde.IdentificationResponse.from_orm(ident)

@router.get("/token/{token_number}/identifications", response_model=List[schemas_pde.IdentificationResponse])
def list_identifications(token_number: str, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    return [schemas_pde.IdentificationResponse.from_orm(i) for i in token.identifications]

# ---------------------------------------------------------------------------
# Stamp payment step (repeatable)
# ---------------------------------------------------------------------------
@router.post("/token/{token_number}/stamp-payments", response_model=schemas_pde.StampPaymentResponse)
def add_stamp_payment(token_number: str, payload: schemas_pde.StampPaymentCreate, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    sp = models_pde.PDEStepStampPayment(
        token_id=token.id,
        paid_by=payload.paid_by,
        amount=payload.amount,
        payment_date=payload.payment_date,
        franking_mc_no=payload.framing_mc_no,
        franking_serial_no=payload.framing_serial_no,
        vendor_name=payload.vendor_name,
    )
    db.add(sp)
    db.commit()
    db.refresh(sp)
    return schemas_pde.StampPaymentResponse.from_orm(sp)

@router.get("/token/{token_number}/stamp-payments", response_model=List[schemas_pde.StampPaymentResponse])
def list_stamp_payments(token_number: str, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    return [schemas_pde.StampPaymentResponse.from_orm(sp) for sp in token.stamp_payments]

# ---------------------------------------------------------------------------
# Report endpoint (placeholder – returns simple JSON for now)
# ---------------------------------------------------------------------------
@router.get("/token/{token_number}/report")
def get_report(token_number: str, db: Session = Depends(get_db)):
    token = get_token_or_404(token_number, db)
    # In a real implementation we'd render a bilingual PDF/HTML.
    return {"token": token.token_number, "status": token.status.value, "message": "Report generation not yet implemented"}
