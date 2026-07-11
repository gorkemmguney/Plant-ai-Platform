from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import AppUser
from app.schemas.customer import CustomerCreateIn, CustomerOut
from app.services.customer_service import create_customer_profile, get_customer_by_user_id

router = APIRouter(prefix="/customers", tags=["customers"])


@router.post("/me", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_my_customer_profile(
    payload: CustomerCreateIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    return await create_customer_profile(db, user.user_id, payload)


@router.get("/me", response_model=CustomerOut)
async def get_my_customer_profile(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    cust = await get_customer_by_user_id(db, user.user_id)
    if cust is None:
        raise HTTPException(status_code=404, detail="Müşteri profili bulunamadı")
    return cust
