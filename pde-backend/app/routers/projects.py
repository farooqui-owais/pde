from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from .. import models, models_scheme, schemas_scheme
from ..security import get_current_user

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])


@router.post("", response_model=schemas_scheme.ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: schemas_scheme.ProjectCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = models_scheme.Project(
        project_name=payload.project_name,
        developed_by=payload.developed_by,
        project_pan=payload.project_pan,
        district=payload.district,
        taluka=payload.taluka,
        village=payload.village,
        corporation=payload.corporation,
        gat_number=payload.gat_number,
        survey_number=payload.survey_number,
        hissa_number=payload.hissa_number,
        location=payload.location,
        sub_location=payload.sub_location,
        rate=payload.rate,
        created_by=current_user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[schemas_scheme.ProjectOut])
def list_projects(
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    q = db.query(models_scheme.Project).filter(
        models_scheme.Project.created_by == current_user.id,
        models_scheme.Project.is_active == True,
    )
    if search:
        q = q.filter(models_scheme.Project.project_name.ilike(f"%{search}%"))
    return q.order_by(models_scheme.Project.created_at.desc()).all()


@router.get("/{project_id}", response_model=schemas_scheme.ProjectOut)
def get_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = (
        db.query(models_scheme.Project)
        .filter(
            models_scheme.Project.id == project_id,
            models_scheme.Project.created_by == current_user.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


@router.put("/{project_id}", response_model=schemas_scheme.ProjectOut)
def update_project(
    project_id: str,
    payload: schemas_scheme.ProjectUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = (
        db.query(models_scheme.Project)
        .filter(
            models_scheme.Project.id == project_id,
            models_scheme.Project.created_by == current_user.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    project = (
        db.query(models_scheme.Project)
        .filter(
            models_scheme.Project.id == project_id,
            models_scheme.Project.created_by == current_user.id,
        )
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")

    project.is_active = False
    db.commit()
    return None
