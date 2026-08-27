from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/api/reference", tags=["reference"])


@router.get("/districts", response_model=List[schemas.DistrictOut])
def list_districts(db: Session = Depends(get_db)):
    return db.query(models.District).order_by(models.District.name).all()


@router.get("/offices", response_model=List[schemas.OfficeOut])
def list_offices(district_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(models.RegistrationOffice)
    if district_id:
        q = q.filter(models.RegistrationOffice.district_id == district_id)
    return q.order_by(models.RegistrationOffice.name).all()


@router.get("/article-types", response_model=List[schemas.ArticleTypeOut])
def list_article_types(db: Session = Depends(get_db)):
    return db.query(models.ArticleType).order_by(models.ArticleType.id).all()


@router.get("/document-titles", response_model=List[schemas.DocumentTitleOut])
def list_document_titles(article_type_id: int, db: Session = Depends(get_db)):
    return (
        db.query(models.DocumentTitle)
        .filter(models.DocumentTitle.article_type_id == article_type_id)
        .order_by(models.DocumentTitle.id)
        .all()
    )
