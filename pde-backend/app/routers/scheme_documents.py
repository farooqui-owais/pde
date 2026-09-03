import os
import shutil
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, models_scheme, schemas_scheme
from ..security import get_current_user

router = APIRouter(tags=["scheme-documents"])

UPLOAD_DIR = os.path.join(os.getcwd(), "uploads", "scheme_documents")
os.makedirs(UPLOAD_DIR, exist_ok=True)
MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB limit


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


@router.get("/api/v1/schemes/{scheme_id}/documents", response_model=List[schemas_scheme.SchemeDocumentOut])
@router.get("/api/properties/documents", response_model=List[schemas_scheme.SchemeDocumentOut])
def list_scheme_documents(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)
    return [d for d in scheme.documents if d.is_active]


@router.post("/api/v1/schemes/{scheme_id}/documents", response_model=schemas_scheme.SchemeDocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_scheme_document(
    scheme_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)

    # Validate file extension and MIME type
    filename = file.filename or ""
    if not filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF documents (.pdf) are allowed.",
        )

    # Read and check size
    contents = await file.read()
    file_size = len(contents)
    if file_size > MAX_FILE_SIZE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File size exceeds maximum limit of 20MB.",
        )

    # Save to storage path
    file_ext = os.path.splitext(filename)[1]
    safe_doc_type = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in document_type)
    safe_filename = f"{scheme_id}_{safe_doc_type}_{models_scheme.gen_uuid()[:8]}{file_ext}"
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    storage_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(storage_path, "wb") as f:
        f.write(contents)

    # Check if a document of this type already exists in this scheme, increment version
    existing_doc = (
        db.query(models_scheme.SchemeDocument)
        .filter(
            models_scheme.SchemeDocument.scheme_id == scheme_id,
            models_scheme.SchemeDocument.document_type == document_type,
            models_scheme.SchemeDocument.is_active == True,
        )
        .first()
    )

    version = 1
    if existing_doc:
        version = existing_doc.version + 1
        existing_doc.is_active = False

    doc_record = models_scheme.SchemeDocument(
        scheme_id=scheme.id,
        document_type=document_type,
        document_name=filename,
        storage_key=storage_path,
        mime_type="application/pdf",
        file_size=file_size,
        version=version,
        is_active=True,
        uploaded_by=current_user.id,
    )
    db.add(doc_record)
    db.commit()
    db.refresh(doc_record)
    return doc_record


@router.get("/api/v1/schemes/{scheme_id}/documents/{document_id}/download")
@router.get("/api/properties/documents/download")
def download_scheme_document(
    scheme_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)
    doc = (
        db.query(models_scheme.SchemeDocument)
        .filter(
            models_scheme.SchemeDocument.id == document_id,
            models_scheme.SchemeDocument.scheme_id == scheme.id,
        )
        .first()
    )
    if not doc or not os.path.exists(doc.storage_key):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document file not found")

    return FileResponse(
        path=doc.storage_key,
        filename=doc.document_name,
        media_type=doc.mime_type,
    )


@router.delete("/api/v1/schemes/{scheme_id}/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scheme_document(
    scheme_id: str,
    document_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)
    doc = (
        db.query(models_scheme.SchemeDocument)
        .filter(
            models_scheme.SchemeDocument.id == document_id,
            models_scheme.SchemeDocument.scheme_id == scheme.id,
        )
        .first()
    )
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.is_active = False
    db.commit()
    return None
