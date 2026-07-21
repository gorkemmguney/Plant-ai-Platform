import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.campaign import Campaign, UserCoupon
from app.models.user import AppUser
from app.schemas.campaign import CampaignOut, CouponOut, RedeemOut

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Campaign).where(Campaign.is_active.is_(True)).order_by(Campaign.required_points)
    )
    return result.scalars().all()


@router.post("/{campaign_id}/redeem", response_model=RedeemOut)
async def redeem_campaign(
    campaign_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    campaign = (
        await db.execute(select(Campaign).where(Campaign.campaign_id == campaign_id))
    ).scalar_one_or_none()
    if campaign is None or not campaign.is_active:
        raise HTTPException(status_code=404, detail="Kampanya bulunamadı")

    if (user.points or 0) < campaign.required_points:
        raise HTTPException(status_code=400, detail="Bu kampanya için yeterli puanın yok")

    user.points = (user.points or 0) - campaign.required_points

    # Kampanyayı kupona çevir — sepette harcanana kadar kullanıcıda durur
    coupon_code = "PLANT" + secrets.token_hex(3).upper()
    coupon = UserCoupon(
        user_id=user.user_id,
        code=coupon_code,
        discount_amount=campaign.discount_amount,
    )
    db.add(coupon)
    await db.commit()

    return RedeemOut(
        detail="Kupon oluşturuldu 🎉 Sepette kullanabilirsin",
        coupon_code=coupon_code,
        remaining_points=user.points,
    )
