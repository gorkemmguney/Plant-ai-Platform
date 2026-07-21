from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.campaign import UserCoupon
from app.models.user import AppUser
from app.schemas.campaign import CouponOut

router = APIRouter(prefix="/coupons", tags=["coupons"])


@router.get("/mine", response_model=list[CouponOut])
async def my_coupons(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    """Kullanıcının henüz harcamadığı kuponları — sepette gösterilir."""
    result = await db.execute(
        select(UserCoupon)
        .where(UserCoupon.user_id == user.user_id, UserCoupon.is_used.is_(False))
        .order_by(UserCoupon.created_at.desc())
    )
    return result.scalars().all()
