import os
import shutil
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models
from ..security import get_current_user
from ..validators import validate_draft_category

router = APIRouter(tags=["Digital Submission"])

UPLOAD_BASE_DIR = os.path.join(os.getcwd(), "uploads", "digital_submission")
os.makedirs(UPLOAD_BASE_DIR, exist_ok=True)
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB limit


def _validate_pdf_upload(filename: Optional[str], default_name: str) -> str:
    """Common PDF-only + non-empty filename guard for each upload handler."""
    name = (filename or default_name).strip()
    if not name:
        raise HTTPException(status_code=400, detail="A file must be selected.")
    if not name.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are allowed.")
    return name


def _entry_or_404(db: Session, entry_id: str, current_user: models.User) -> models.DocumentEntry:
    entry = (
        db.query(models.DocumentEntry)
        .filter(
            models.DocumentEntry.id == entry_id,
            models.DocumentEntry.user_id == current_user.id,
        )
        .first()
    )
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document entry not found.")
    return entry


class PreferenceRequest(BaseModel):
    wants_digital_submission: bool


class PreferenceOut(BaseModel):
    wants_digital_submission: bool


class DraftFileOut(BaseModel):
    id: str
    document_entry_id: str
    category: str
    original_filename: str
    file_size: int
    uploaded_at: str


class AnnexureFileOut(BaseModel):
    id: str
    document_entry_id: str
    title: str
    title_other: Optional[str] = None
    poa_name: Optional[str] = None
    poa_principle: Optional[str] = None
    original_filename: str
    file_size: int
    uploaded_at: str


class PartyFileDetailOut(BaseModel):
    id: str
    party_id: str
    doc_kind: str
    proof_type: Optional[str] = None
    original_filename: str
    file_size: int
    uploaded_at: str


class PartyWithFilesOut(BaseModel):
    party_id: str
    party_name: str
    identity_file: Optional[PartyFileDetailOut] = None
    pan_file: Optional[PartyFileDetailOut] = None


# ---------------- Preference Endpoints ----------------

@router.get("/api/documents/{entry_id}/digital-submission-preference", response_model=PreferenceOut)
def get_preference(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    pref = (
        db.query(models.DigitalSubmissionPreference)
        .filter(models.DigitalSubmissionPreference.document_entry_id == entry_id)
        .first()
    )
    return PreferenceOut(wants_digital_submission=pref.wants_digital_submission if pref else False)


@router.put("/api/documents/{entry_id}/digital-submission-preference", response_model=PreferenceOut)
def update_preference(
    entry_id: str,
    payload: PreferenceRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    pref = (
        db.query(models.DigitalSubmissionPreference)
        .filter(models.DigitalSubmissionPreference.document_entry_id == entry_id)
        .first()
    )
    if not pref:
        pref = models.DigitalSubmissionPreference(
            document_entry_id=entry_id,
            wants_digital_submission=payload.wants_digital_submission,
        )
        db.add(pref)
    else:
        pref.wants_digital_submission = payload.wants_digital_submission
    db.commit()
    return PreferenceOut(wants_digital_submission=pref.wants_digital_submission)


# ---------------- Draft & Execution Page Files ----------------

@router.get("/api/documents/{entry_id}/draft-files", response_model=List[DraftFileOut])
def list_draft_files(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    rows = (
        db.query(models.DraftDocumentFile)
        .filter(models.DraftDocumentFile.document_entry_id == entry_id)
        .all()
    )
    return [
        DraftFileOut(
            id=r.id,
            document_entry_id=r.document_entry_id,
            category=r.category,
            original_filename=r.original_filename,
            file_size=r.file_size,
            uploaded_at=r.uploaded_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/api/documents/{entry_id}/draft-files", response_model=DraftFileOut, status_code=201)
def upload_draft_file(
    entry_id: str,
    category: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    category = validate_draft_category(category)  # allowlist the two known categories
    filename = _validate_pdf_upload(file.filename, "file.pdf")

    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 20 MB limit.")

    entry_dir = os.path.join(UPLOAD_BASE_DIR, entry_id, "drafts")
    os.makedirs(entry_dir, exist_ok=True)

    record = models.DraftDocumentFile(
        document_entry_id=entry_id,
        category=category,
        original_filename=filename,
        stored_path="",
        file_size=size,
        uploaded_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    dest_path = os.path.join(entry_dir, f"{record.id}_{filename}")
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    record.stored_path = dest_path
    db.commit()

    return DraftFileOut(
        id=record.id,
        document_entry_id=record.document_entry_id,
        category=record.category,
        original_filename=record.original_filename,
        file_size=record.file_size,
        uploaded_at=record.uploaded_at.isoformat(),
    )


@router.get("/api/documents/{entry_id}/draft-files/{file_id}")
def view_draft_file(
    entry_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    row = db.query(models.DraftDocumentFile).filter(models.DraftDocumentFile.id == file_id).first()
    if not row or not os.path.exists(row.stored_path):
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(row.stored_path, media_type="application/pdf", filename=row.original_filename)


@router.delete("/api/documents/{entry_id}/draft-files/{file_id}", status_code=204)
def delete_draft_file(
    entry_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    row = db.query(models.DraftDocumentFile).filter(models.DraftDocumentFile.id == file_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="File not found.")
    if os.path.exists(row.stored_path):
        try:
            os.remove(row.stored_path)
        except OSError:
            pass
    db.delete(row)
    db.commit()
    return None


# ---------------- Annexure Files ----------------

@router.get("/api/documents/{entry_id}/annexure-files", response_model=List[AnnexureFileOut])
def list_annexure_files(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    rows = (
        db.query(models.AnnexureFile)
        .filter(models.AnnexureFile.document_entry_id == entry_id)
        .all()
    )
    return [
        AnnexureFileOut(
            id=r.id,
            document_entry_id=r.document_entry_id,
            title=r.title,
            title_other=r.title_other,
            poa_name=r.poa_name,
            poa_principle=r.poa_principle,
            original_filename=r.original_filename,
            file_size=r.file_size,
            uploaded_at=r.uploaded_at.isoformat(),
        )
        for r in rows
    ]


@router.post("/api/documents/{entry_id}/annexure-files", response_model=AnnexureFileOut, status_code=201)
def upload_annexure_file(
    entry_id: str,
    title: str = Form("Scanned Required Annexure"),
    title_other: Optional[str] = Form(None),
    poa_name: Optional[str] = Form(None),
    poa_principle: Optional[str] = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    filename = _validate_pdf_upload(file.filename, "annexure.pdf")
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 20 MB limit.")

    entry_dir = os.path.join(UPLOAD_BASE_DIR, entry_id, "annexures")
    os.makedirs(entry_dir, exist_ok=True)

    record = models.AnnexureFile(
        document_entry_id=entry_id,
        title=title,
        title_other=title_other,
        poa_name=poa_name,
        poa_principle=poa_principle,
        original_filename=filename,
        stored_path="",
        file_size=size,
        uploaded_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    dest_path = os.path.join(entry_dir, f"{record.id}_{filename}")
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    record.stored_path = dest_path
    db.commit()

    return AnnexureFileOut(
        id=record.id,
        document_entry_id=record.document_entry_id,
        title=record.title,
        title_other=record.title_other,
        poa_name=record.poa_name,
        poa_principle=record.poa_principle,
        original_filename=record.original_filename,
        file_size=record.file_size,
        uploaded_at=record.uploaded_at.isoformat(),
    )


@router.get("/api/documents/{entry_id}/annexure-files/{file_id}")
def view_annexure_file(
    entry_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    row = db.query(models.AnnexureFile).filter(models.AnnexureFile.id == file_id).first()
    if not row or not os.path.exists(row.stored_path):
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(row.stored_path, filename=row.original_filename)


@router.delete("/api/documents/{entry_id}/annexure-files/{file_id}", status_code=204)
def delete_annexure_file(
    entry_id: str,
    file_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    _entry_or_404(db, entry_id, current_user)
    row = db.query(models.AnnexureFile).filter(models.AnnexureFile.id == file_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="File not found.")
    if os.path.exists(row.stored_path):
        try:
            os.remove(row.stored_path)
        except OSError:
            pass
    db.delete(row)
    db.commit()
    return None


# ---------------- Party Related Files ----------------

@router.get("/api/documents/{entry_id}/party-files", response_model=List[PartyWithFilesOut])
def list_party_files(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)
    result = []
    for party in entry.parties:
        files = db.query(models.PartyDocumentFile).filter(models.PartyDocumentFile.party_id == party.id).all()
        id_file = next((f for f in files if f.doc_kind == "IDENTITY"), None)
        pan_file = next((f for f in files if f.doc_kind == "PAN_FORM16"), None)

        name = f"{party.first_name_en or party.first_name_mr or ''} {party.surname_en or party.surname_mr or ''}".strip() or "Unnamed Party"
        result.append(
            PartyWithFilesOut(
                party_id=party.id,
                party_name=name,
                identity_file=PartyFileDetailOut(
                    id=id_file.id,
                    party_id=id_file.party_id,
                    doc_kind=id_file.doc_kind,
                    proof_type=id_file.proof_type,
                    original_filename=id_file.original_filename,
                    file_size=id_file.file_size,
                    uploaded_at=id_file.uploaded_at.isoformat(),
                ) if id_file else None,
                pan_file=PartyFileDetailOut(
                    id=pan_file.id,
                    party_id=pan_file.party_id,
                    doc_kind=pan_file.doc_kind,
                    proof_type=pan_file.proof_type,
                    original_filename=pan_file.original_filename,
                    file_size=pan_file.file_size,
                    uploaded_at=pan_file.uploaded_at.isoformat(),
                ) if pan_file else None,
            )
        )
    return result


@router.post("/api/parties/{party_id}/identity-file", response_model=PartyFileDetailOut, status_code=201)
def upload_party_identity_file(
    party_id: str,
    proof_type: str = Form("Aadhar Card"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    party = db.query(models.PartyDetail).filter(models.PartyDetail.id == party_id).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found.")
    _entry_or_404(db, party.document_entry_id, current_user)

    filename = _validate_pdf_upload(file.filename, "identity.pdf")
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 20 MB limit.")

    party_dir = os.path.join(UPLOAD_BASE_DIR, party.document_entry_id, "party_files")
    os.makedirs(party_dir, exist_ok=True)

    # Remove existing identity file for this party if present
    existing = (
        db.query(models.PartyDocumentFile)
        .filter(models.PartyDocumentFile.party_id == party_id, models.PartyDocumentFile.doc_kind == "IDENTITY")
        .first()
    )
    if existing:
        if os.path.exists(existing.stored_path):
            try:
                os.remove(existing.stored_path)
            except OSError:
                pass
        db.delete(existing)
        db.commit()

    record = models.PartyDocumentFile(
        party_id=party_id,
        doc_kind="IDENTITY",
        proof_type=proof_type,
        original_filename=filename,
        stored_path="",
        file_size=size,
        uploaded_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    dest_path = os.path.join(party_dir, f"{record.id}_{filename}")
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    record.stored_path = dest_path
    db.commit()

    return PartyFileDetailOut(
        id=record.id,
        party_id=record.party_id,
        doc_kind=record.doc_kind,
        proof_type=record.proof_type,
        original_filename=record.original_filename,
        file_size=record.file_size,
        uploaded_at=record.uploaded_at.isoformat(),
    )


@router.post("/api/parties/{party_id}/pan-file", response_model=PartyFileDetailOut, status_code=201)
def upload_party_pan_file(
    party_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    party = db.query(models.PartyDetail).filter(models.PartyDetail.id == party_id).first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found.")
    _entry_or_404(db, party.document_entry_id, current_user)

    filename = _validate_pdf_upload(file.filename, "pan.pdf")
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds maximum 20 MB limit.")

    party_dir = os.path.join(UPLOAD_BASE_DIR, party.document_entry_id, "party_files")
    os.makedirs(party_dir, exist_ok=True)

    # Remove existing pan file for this party if present
    existing = (
        db.query(models.PartyDocumentFile)
        .filter(models.PartyDocumentFile.party_id == party_id, models.PartyDocumentFile.doc_kind == "PAN_FORM16")
        .first()
    )
    if existing:
        if os.path.exists(existing.stored_path):
            try:
                os.remove(existing.stored_path)
            except OSError:
                pass
        db.delete(existing)
        db.commit()

    record = models.PartyDocumentFile(
        party_id=party_id,
        doc_kind="PAN_FORM16",
        proof_type="PAN Card",
        original_filename=filename,
        stored_path="",
        file_size=size,
        uploaded_by=current_user.id,
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    dest_path = os.path.join(party_dir, f"{record.id}_{filename}")
    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    record.stored_path = dest_path
    db.commit()

    return PartyFileDetailOut(
        id=record.id,
        party_id=record.party_id,
        doc_kind=record.doc_kind,
        proof_type=record.proof_type,
        original_filename=record.original_filename,
        file_size=record.file_size,
        uploaded_at=record.uploaded_at.isoformat(),
    )


@router.get("/api/party-files/{file_id}")
def view_party_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = db.query(models.PartyDocumentFile).filter(models.PartyDocumentFile.id == file_id).first()
    if not row or not os.path.exists(row.stored_path):
        raise HTTPException(status_code=404, detail="File not found.")
    return FileResponse(row.stored_path, filename=row.original_filename)


@router.delete("/api/party-files/{file_id}", status_code=204)
def delete_party_file(
    file_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    row = db.query(models.PartyDocumentFile).filter(models.PartyDocumentFile.id == file_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="File not found.")
    if os.path.exists(row.stored_path):
        try:
            os.remove(row.stored_path)
        except OSError:
            pass
    db.delete(row)
    db.commit()
    return None


# ---------------- Final Submit Endpoint ----------------

@router.post("/api/documents/{entry_id}/submit-digital-package")
def submit_digital_package(
    entry_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    entry = _entry_or_404(db, entry_id, current_user)

    # 1. Validate preference is YES
    pref = (
        db.query(models.DigitalSubmissionPreference)
        .filter(models.DigitalSubmissionPreference.document_entry_id == entry_id)
        .first()
    )
    if not pref or not pref.wants_digital_submission:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Digital document facility option is not set to YES.",
        )

    # 2. Validate two compulsory draft categories exist
    draft_files = (
        db.query(models.DraftDocumentFile)
        .filter(models.DraftDocumentFile.document_entry_id == entry_id)
        .all()
    )
    categories_present = {f.category for f in draft_files}
    cat1 = "Digital Document (without Execution Page)"
    cat2 = "Digital Execution Page (without sign)"
    if cat1 not in categories_present or cat2 not in categories_present:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Both compulsory documents ('Digital Document' and 'Digital Execution Page') must be uploaded before submitting.",
        )

    # 3. Validate at least 1 witness exists
    witnesses = (
        db.query(models.IdentificationDetail)
        .filter(models.IdentificationDetail.document_entry_id == entry_id)
        .all()
    )
    if not witnesses:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Add witnesses before submit. At least one witness/identifier must be added.",
        )

    entry.status = "SUBMITTED"
    db.commit()

    return {
        "status": "SUBMITTED",
        "message": "Digital document package submitted successfully.",
    }
