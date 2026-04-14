from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List

from ..database import get_db
from ..models.models import DiseaseClass
from ..schemas.schemas import DiseaseOut
from .deps import get_current_user

router = APIRouter(prefix="/diseases", tags=["Diseases"])


@router.get("", response_model=List[DiseaseOut])
async def list_diseases(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DiseaseClass).options(selectinload(DiseaseClass.steps))
    )
    return result.scalars().all()


@router.get("/{code}", response_model=DiseaseOut)
async def get_disease(code: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DiseaseClass)
        .options(selectinload(DiseaseClass.steps))
        .where(DiseaseClass.code == code)
    )
    disease = result.scalar_one_or_none()
    if not disease:
        raise HTTPException(404, "Disease not found")
    return disease
