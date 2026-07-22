from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.location import Il, Ilce, Mahalle
from app.schemas.location import IlceOut, IlOut, MahalleOut

router = APIRouter(prefix="/locations", tags=["locations"])


@router.get("/il", response_model=list[IlOut])
async def list_il(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Il).order_by(Il.name))
    return result.scalars().all()


@router.get("/ilce", response_model=list[IlceOut])
async def list_ilce(il_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Ilce).where(Ilce.il_id == il_id).order_by(Ilce.name))
    return result.scalars().all()


@router.get("/mahalle", response_model=list[MahalleOut])
async def list_mahalle(ilce_id: int = Query(...), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Mahalle).where(Mahalle.ilce_id == ilce_id).order_by(Mahalle.name))
    return result.scalars().all()
