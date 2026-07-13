from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, get_user_roles
from app.db.session import get_db
from app.models.user import AppUser
from app.schemas.user import UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
async def get_me(user: AppUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
   
    roles = await get_user_roles(user, db)
    return UserOut(
        user_id=user.user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        created_at=user.created_at,
        roles=roles,
    )
