import random
import string
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, models_scheme, schemas_scheme
from ..scheme_validation import (
    MANDATORY_SCHEME_DOCUMENT_TYPES,
    raise_if_scheme_not_submittable,
    validate_scheme_submission_readiness,
)
from ..security import get_current_user

router = APIRouter(prefix="/api/v1/schemes", tags=["schemes"])


def generate_scheme_number() -> str:
    stamp = datetime.utcnow().strftime("%Y%m")
    suffix = "".join(random.choices(string.digits, k=5))
    return f"SCH-{stamp}-{suffix}"


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


@router.post("", response_model=schemas_scheme.SchemeOut, status_code=status.HTTP_201_CREATED)
def create_scheme(
    payload: schemas_scheme.SchemeCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = (
        db.query(models_scheme.Project)
        .filter(
            models_scheme.Project.id == payload.project_id,
            models_scheme.Project.created_by == current_user.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    scheme = models_scheme.Scheme(
        project_id=payload.project_id,
        article=payload.article,
        document_title=payload.document_title,
        scheme_name=payload.scheme_name,
        draft_title=payload.draft_title,
        maha_rera_number=payload.maha_rera_number,
        project_area=payload.project_area,
        project_area_unit=payload.project_area_unit or "sq.ft",
        rera_validation_date=payload.rera_validation_date,
        rate=payload.rate,
        valuation_rule=payload.valuation_rule,
        scheme_number=generate_scheme_number(),
        description=payload.description,
        status="draft",
        total_units=payload.total_units,
        total_area=payload.total_area,
        rate_per_sqft=payload.rate_per_sqft,
        created_by=current_user.id,
    )
    db.add(scheme)
    db.commit()
    db.refresh(scheme)
    scheme.project_name = project.project_name
    return scheme


@router.get("", response_model=schemas_scheme.SchemeListResponse)
def list_schemes(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = (
        db.query(models_scheme.Scheme)
        .join(models_scheme.Project)
        .filter(models_scheme.Scheme.created_by == current_user.id)
    )

    if search:
        pattern = f"%{search}%"
        q = q.filter(
            (models_scheme.Scheme.scheme_name.ilike(pattern))
            | (models_scheme.Scheme.scheme_number.ilike(pattern))
            | (models_scheme.Project.project_name.ilike(pattern))
        )

    if status_filter:
        q = q.filter(models_scheme.Scheme.status == status_filter)

    total = q.count()
    schemes = (
        q.order_by(models_scheme.Scheme.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    items = []
    for s in schemes:
        out = schemas_scheme.SchemeOut.from_orm(s)
        out.project_name = s.project.project_name if s.project else None
        items.append(out)

    return schemas_scheme.SchemeListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/{scheme_id}", response_model=schemas_scheme.SchemeOut)
def get_scheme(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)
    out = schemas_scheme.SchemeOut.from_orm(scheme)
    out.project_name = scheme.project.project_name if scheme.project else None
    return out


@router.put("/{scheme_id}", response_model=schemas_scheme.SchemeOut)
def update_scheme(
    scheme_id: str,
    payload: schemas_scheme.SchemeUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(scheme, field, value)

    db.commit()
    db.refresh(scheme)
    out = schemas_scheme.SchemeOut.from_orm(scheme)
    out.project_name = scheme.project.project_name if scheme.project else None
    return out


@router.post("/{scheme_id}/modify", response_model=schemas_scheme.SchemeStatusResponse)
def modify_scheme(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Transitions a scheme back into modifiable / draft mode."""
    scheme = _scheme_or_404(db, scheme_id, current_user)

    if scheme.status == "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Approved scheme cannot be modified directly.",
        )

    scheme.status = "draft"
    db.commit()
    return schemas_scheme.SchemeStatusResponse(
        scheme_id=scheme.id,
        status=scheme.status,
        message="Scheme is now in modify mode.",
    )


@router.get("/{scheme_id}/submission-check", response_model=schemas_scheme.SchemeSubmitCheckResponse)
def check_submission_readiness(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)

    errors = validate_scheme_submission_readiness(scheme)
    can_submit = len(errors) == 0

    seller_count = len(scheme.seller_parties)
    has_seller = seller_count > 0
    has_identifier = scheme.identifier is not None
    active_docs = [d for d in scheme.documents if d.is_active]
    docs_count = len(active_docs)
    uploaded_types = {d.document_type for d in active_docs}
    has_mandatory_docs = all(t in uploaded_types for t in MANDATORY_SCHEME_DOCUMENT_TYPES)
    templates_count = len(scheme.templates)
    has_templates = templates_count > 0

    return schemas_scheme.SchemeSubmitCheckResponse(
        can_submit=can_submit,
        has_seller_parties=has_seller,
        seller_parties_count=seller_count,
        has_identifier=has_identifier,
        has_mandatory_documents=has_mandatory_docs,
        documents_count=docs_count,
        has_templates=has_templates,
        templates_count=templates_count,
        errors=errors,
    )


@router.post("/{scheme_id}/submit", response_model=schemas_scheme.SchemeStatusResponse)
def submit_scheme(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)
    raise_if_scheme_not_submittable(scheme)

    scheme.status = "submitted"
    db.commit()

    return schemas_scheme.SchemeStatusResponse(
        scheme_id=scheme.id,
        status=scheme.status,
        message="Scheme submitted successfully.",
    )
