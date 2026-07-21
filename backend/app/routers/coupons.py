from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.campaign import UserCoupon
from app.models.user import AppUser
from app.schemas.campaign import CouponOut

router = APIRouter(prefix="/coupons", tags=["coupons"])


def _store_name(store_name: str | None, first: str | None, last: str | None) -> str | None:
    if store_name:
        return store_name
    full = " ".join(p for p in [first, last] if p)
    return full or None


@router.get("/mine", response_model=list[CouponOut])
async def my_coupons(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    """Kullanıcının henüz harcamadığı kuponları — sepette gösterilir."""
    seller = aliased(AppUser)
    rows = (
        await db.execute(
            select(UserCoupon, seller.store_name, seller.first_name, seller.last_name)
            .outerjoin(seller, seller.user_id == UserCoupon.seller_id)
            .where(UserCoupon.user_id == user.user_id, UserCoupon.is_used.is_(False))
            .order_by(UserCoupon.created_at.desc())
        )
    ).all()
    return [
        CouponOut(
            coupon_id=c.coupon_id,
            code=c.code,
            discount_amount=float(c.discount_amount),
            seller_id=c.seller_id,
            seller_name=_store_name(store_name, first, last),
        )
        for (c, store_name, first, last) in rows
    ]
