import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.campaign import Campaign, UserCoupon
from app.models.customer import Ind, Org
from app.models.user import AppUser

from app.schemas.campaign import CampaignOut, RedeemOut

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def _store_name(store_name: str | None, first: str | None, last: str | None) -> str | None:
    if store_name:
        return store_name
    full = " ".join(p for p in [first, last] if p)
    return full or None


@router.get("", response_model=list[CampaignOut])
async def list_campaigns(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    # Tek seferlik: kullanıcının daha önce aldığı kampanyalar listede gösterilmez
    redeemed = (
        await db.execute(
            select(UserCoupon.campaign_id).where(
                UserCoupon.user_id == user.user_id, UserCoupon.campaign_id.isnot(None)
            )
        )
    ).scalars().all()

    query = (
        select(Campaign, Org.store_name, Org.company_name, Ind.first_name, Ind.last_name)
        .outerjoin(Org, Org.user_id == Campaign.seller_id)
        .outerjoin(Ind, Ind.user_id == Campaign.seller_id)
        .where(Campaign.is_active.is_(True))
        .order_by(Campaign.seller_id, Campaign.required_points)
    )
    if redeemed:
        query = query.where(Campaign.campaign_id.notin_(redeemed))

    rows = (await db.execute(query)).all()
    return [
        CampaignOut(
            campaign_id=c.campaign_id,
            title=c.title,
            description=c.description,
            required_points=c.required_points,
            reward_text=c.reward_text,
            seller_id=c.seller_id,
            seller_name=_store_name(store_name or company_name, first, last),
        )
        for (c, store_name, company_name, first, last) in rows
    ]



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

    # Tek seferlik: bu kampanya daha önce alındıysa tekrar alınamaz
    already = (
        await db.execute(
            select(UserCoupon.coupon_id).where(
                UserCoupon.user_id == user.user_id, UserCoupon.campaign_id == campaign_id
            )
        )
    ).first()
    if already is not None:
        raise HTTPException(status_code=400, detail="Bu kampanyayı zaten kullandın")

    if (user.points or 0) < campaign.required_points:
        raise HTTPException(status_code=400, detail="Bu kampanya için yeterli puanın yok")

    user.points = (user.points or 0) - campaign.required_points

    coupon_code = "PLANT" + secrets.token_hex(3).upper()
    coupon = UserCoupon(
        user_id=user.user_id,
        campaign_id=campaign.campaign_id,
        seller_id=campaign.seller_id,
        code=coupon_code,
        discount_amount=campaign.discount_amount,
    )
    db.add(coupon)
    await db.commit()

    return RedeemOut(
        detail="Kupon oluşturuldu 🎉 Sepette bu mağazada kullanabilirsin",
        coupon_code=coupon_code,
        remaining_points=user.points,
    )
