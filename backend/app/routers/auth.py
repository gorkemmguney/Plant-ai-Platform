from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, get_user_roles
from app.db.session import get_db
from app.models.user import AppUser, Role, UserRole
from app.schemas.user import RegisterIn, UserOut
from app.services.seller_service import create_seller_profile, get_seller_profile_by_user_id

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserOut)
async def get_me(user: AppUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    roles = await get_user_roles(user, db)
    seller_profile = await get_seller_profile_by_user_id(db, user.user_id) if "seller" in roles else None

    return UserOut(
        user_id=user.user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        created_at=user.created_at,
        roles=roles,
        is_seller_verified=seller_profile.is_verified if seller_profile else None,
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    payload: RegisterIn,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing_roles = await get_user_roles(user, db)
    if existing_roles:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Kullanıcının zaten bir rolü var")

    role_result = await db.execute(select(Role).where(Role.role_name == payload.role_name))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rol bulunamadı")

    db.add(UserRole(user_id=user.user_id, role_id=role.role_id))

    if payload.role_name == "seller":
        await create_seller_profile(db, user.user_id)

    await db.commit()

    roles = await get_user_roles(user, db)
    seller_profile = await get_seller_profile_by_user_id(db, user.user_id) if "seller" in roles else None

    return UserOut(
        user_id=user.user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        created_at=user.created_at,
        roles=roles,
        is_seller_verified=seller_profile.is_verified if seller_profile else None,
    )
