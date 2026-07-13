from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.seller import SellerProfile


async def get_seller_profile_by_user_id(db: AsyncSession, user_id: int) -> SellerProfile | None:
    result = await db.execute(select(SellerProfile).where(SellerProfile.user_id == user_id))
    return result.scalar_one_or_none()


async def create_seller_profile(db: AsyncSession, user_id: int) -> SellerProfile:
    profile = SellerProfile(user_id=user_id, is_verified=False)
    db.add(profile)
    await db.flush()
    return profile
