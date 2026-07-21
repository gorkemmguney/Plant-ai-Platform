from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.supabase_auth import set_role_claim
from app.core.security import get_current_user, get_user_roles
from app.db.session import get_db
from app.models.user import AppUser
from app.rbac.roles import ROLE_HIERARCHY, RoleName
from app.schemas.user import ProfileUpdateIn, RoleSelectIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# Kullanıcının kayıt sırasında kendisi seçebileceği roller (admin hariç — güvenlik)
SELF_SELECTABLE_ROLES = {RoleName.CUSTOMER.value, RoleName.SELLER.value}


def _user_out(user: AppUser, roles: list[str]) -> UserOut:
    return UserOut(
        user_id=user.user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        created_at=user.created_at,
        roles=roles,
        seller_status=user.seller_status,
        store_name=user.store_name,
        points=user.points,
    )


@router.get("/me", response_model=UserOut)
async def get_me(user: AppUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    roles = await get_user_roles(user, db)
    return _user_out(user, roles)


@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: ProfileUpdateIn,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.first_name is not None:
        user.first_name = payload.first_name.strip() or user.first_name
    if payload.last_name is not None:
        user.last_name = payload.last_name.strip()
    if payload.store_name is not None:
        user.store_name = payload.store_name.strip() or None
    await db.commit()
    await db.refresh(user)
    roles = await get_user_roles(user, db)
    return _user_out(user, roles)


@router.post("/select-role", response_model=UserOut)
async def select_role(
    payload: RoleSelectIn,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if payload.role_name not in SELF_SELECTABLE_ROLES:
        raise HTTPException(status_code=400, detail="Kayıt sırasında yalnızca müşteri veya satıcı seçilebilir")

    # Herkes temel erişim için 'customer' rolüyle başlar (get_current_user zaten atar).
    # 'seller' seçen kullanıcı ANINDA satıcı olmaz — admin onayı bekleyen bir başvuru oluşur.
    if payload.role_name == RoleName.SELLER.value:
        if user.seller_status != "verified":
            user.seller_status = "pending"
            await db.commit()
            await db.refresh(user)

    roles = await get_user_roles(user, db)
    # Firebase custom claim'i en yüksek role göre ayarla
    if roles:
        top_role = max(roles, key=lambda r: ROLE_HIERARCHY.get(r, -1))
        set_role_claim(user.firebase_uid, top_role)
    return _user_out(user, roles)
