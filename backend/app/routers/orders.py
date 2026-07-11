from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import require_role
from app.db.session import get_db
from app.models.customer import Cust
from app.models.order import CustOrd
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.order import OrderCreateIn, OrderOut
from app.services.order_service import create_order

router = APIRouter(prefix="/orders", tags=["orders"])


async def _get_cust_id(user: AppUser, db: AsyncSession) -> int:
    result = await db.execute(select(Cust).where(Cust.user_id == user.user_id))
    cust = result.scalar_one_or_none()
    if cust is None:
        raise HTTPException(status_code=400, detail="Bu kullanıcı için müşteri profili bulunamadı")
    return cust.cust_id


@router.post("", response_model=OrderOut)
async def create_new_order(
    payload: OrderCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    cust_id = await _get_cust_id(user, db)
    order = await create_order(db, cust_id, payload)
    return order


@router.get("", response_model=list[OrderOut])
async def list_my_orders(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.ADMIN)),
):
    cust_id = await _get_cust_id(user, db)
    result = await db.execute(select(CustOrd).where(CustOrd.cust_id == cust_id))
    return result.scalars().all()
