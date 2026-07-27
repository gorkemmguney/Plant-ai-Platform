from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.session import get_db
from app.models.customer import Cust
from app.models.misc import BsnInter, BsnSpec
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.interaction import InteractionCreateIn, InteractionOut

router = APIRouter(prefix="/interactions", tags=["interactions"])


async def _get_cust_id(user: AppUser, db: AsyncSession) -> int:
    
    result = await db.execute(
        select(Cust).where(Cust.user_id == user.user_id).order_by(Cust.cust_id).limit(1)
    )
    cust = result.scalar_one_or_none()
    if cust is None:
        raise HTTPException(status_code=400, detail="Bu kullanıcı için müşteri profili bulunamadı")
    return cust.cust_id


@router.post("", response_model=InteractionOut, status_code=201)
async def log_interaction(
    payload: InteractionCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    cust_id = await _get_cust_id(user, db)

    spec_result = await db.execute(
        select(BsnSpec).where(BsnSpec.srt_code == payload.srt_code, BsnSpec.is_active.is_(True))
    )
    spec = spec_result.scalar_one_or_none()
    if spec is None:
        raise HTTPException(status_code=400, detail=f"Geçersiz veya pasif etkileşim türü: {payload.srt_code}")

    inter = BsnInter(bsn_spec_id=spec.bsn_spec_id, cust_id=cust_id, sale_cnl_id=payload.sale_cnl_id)
    db.add(inter)
    await db.commit()
    await db.refresh(inter)
    return inter
