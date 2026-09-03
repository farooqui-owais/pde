import re
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, models_scheme, schemas_scheme
from ..security import get_current_user

router = APIRouter(tags=["templates"])


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


@router.get("/api/v1/schemes/{scheme_id}/templates", response_model=List[schemas_scheme.TemplateOut])
@router.get("/api/properties/templates", response_model=List[schemas_scheme.TemplateOut])
def list_templates(
    scheme_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)
    return [t for t in scheme.templates if t.status != "archived"]


@router.post("/api/v1/schemes/{scheme_id}/templates", response_model=schemas_scheme.TemplateOut, status_code=status.HTTP_201_CREATED)
@router.post("/api/properties/templates", response_model=schemas_scheme.TemplateOut, status_code=status.HTTP_201_CREATED)
def create_template(
    scheme_id: str,
    payload: schemas_scheme.TemplateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    scheme = _scheme_or_404(db, scheme_id, current_user)

    template = models_scheme.Template(
        scheme_id=scheme.id,
        template_name=payload.template_name,
        template_code=payload.template_code or f"TMPL-{models_scheme.gen_uuid()[:6].upper()}",
        description=payload.description,
        template_content=payload.template_content or "",
        field_groups=payload.field_groups or [],
        status="draft",
        created_by=current_user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


@router.get("/api/v1/templates/{template_id}", response_model=schemas_scheme.TemplateOut)
def get_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    template = (
        db.query(models_scheme.Template)
        .join(models_scheme.Scheme)
        .filter(
            models_scheme.Template.id == template_id,
            models_scheme.Scheme.created_by == current_user.id,
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")
    return template


@router.put("/api/v1/templates/{template_id}", response_model=schemas_scheme.TemplateOut)
def update_template(
    template_id: str,
    payload: schemas_scheme.TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    template = (
        db.query(models_scheme.Template)
        .join(models_scheme.Scheme)
        .filter(
            models_scheme.Template.id == template_id,
            models_scheme.Scheme.created_by == current_user.id,
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(template, field, value)

    db.commit()
    db.refresh(template)
    return template


@router.delete("/api/v1/templates/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_template(
    template_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    template = (
        db.query(models_scheme.Template)
        .join(models_scheme.Scheme)
        .filter(
            models_scheme.Template.id == template_id,
            models_scheme.Scheme.created_by == current_user.id,
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    template.status = "archived"
    db.commit()
    return None


@router.post("/api/v1/templates/{template_id}/preview", response_model=schemas_scheme.TemplatePreviewResponse)
@router.post("/api/v1/templates/{template_id}/test", response_model=schemas_scheme.TemplatePreviewResponse)
def preview_or_test_template(
    template_id: str,
    payload: schemas_scheme.TemplatePreviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    template = (
        db.query(models_scheme.Template)
        .join(models_scheme.Scheme)
        .filter(
            models_scheme.Template.id == template_id,
            models_scheme.Scheme.created_by == current_user.id,
        )
        .first()
    )
    if not template:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Template not found")

    content = payload.template_content or template.template_content or ""
    sample_data = payload.sample_data or {
        "project.project_name": template.scheme.project.project_name if template.scheme.project else "Sample Project",
        "scheme.scheme_name": template.scheme.scheme_name,
        "scheme.scheme_number": template.scheme.scheme_number or "SCH-2026-001",
        "property.flat_number": "Flat No. 402, 4th Floor",
        "property.built_up_area": "850 sq.ft",
        "property.carpet_area": "650 sq.ft",
        "property.survey_number": "Survey No. 45/2",
        "property.village": template.scheme.project.village if template.scheme.project else "Pune",
        "seller.name": template.scheme.seller_parties[0].party_name if template.scheme.seller_parties else "Sample Seller",
        "seller.pan": template.scheme.seller_parties[0].pan_number if template.scheme.seller_parties else "ABCDE1234F",
        "identifier.name": template.scheme.identifier.name if template.scheme.identifier else "Sample Identifier",
        "document.consideration_amount": "Rs. 75,00,000/-",
        "document.stamp_duty": "Rs. 4,50,000/-",
        "document.date": "31/08/2026",
    }

    # Find tokens like {{token_name}} or {{ token_name }}
    token_pattern = re.compile(r"\{\{\s*([a-zA-Z0-9_\.]+)\s*\}\}")
    all_tokens = token_pattern.findall(content)

    tokens_replaced = []
    missing_tokens = []

    def replace_token(match):
        token_name = match.group(1).strip()
        if token_name in sample_data:
            tokens_replaced.append(token_name)
            return str(sample_data[token_name])
        else:
            missing_tokens.append(token_name)
            return f"[{token_name}]"

    rendered_html = token_pattern.sub(replace_token, content)

    return schemas_scheme.TemplatePreviewResponse(
        rendered_html=rendered_html,
        tokens_replaced=list(set(tokens_replaced)),
        missing_tokens=list(set(missing_tokens)),
    )
