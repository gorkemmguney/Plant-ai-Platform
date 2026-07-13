from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.firebase import InvalidTokenError, verify_id_token
from app.db.session import get_db
from app.models.user import AppUser, Role, UserRole

bearer_scheme = HTTPBearer(auto_error=True)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    try:
        decoded = verify_id_token(credentials.credentials)
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz veya süresi dolmuş token")

    firebase_uid = decoded["uid"]
    email = decoded.get("email", "")
    name = decoded.get("name", "")
    first_name, _, last_name = name.partition(" ")

    result = await db.execute(select(AppUser).where(AppUser.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()

    if user is None:
        # NOT: burada artık otomatik rol ataması YAPILMIYOR.
        # Rol seçimi /auth/register endpoint'i üzerinden kullanıcı tarafından yapılacak.
        user = AppUser(
            firebase_uid=firebase_uid,
            email=email,
            first_name=first_name or "İsimsiz",
            last_name=last_name or "",
            is_active=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hesap devre dışı bırakılmış")

    return user


async def get_user_roles(user: AppUser, db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(Role.role_name).join(UserRole, UserRole.role_id == Role.role_id).where(UserRole.user_id == user.user_id)
    )
    return [r for (r,) in result.all()]


def require_role(*allowed_roles: str):

    async def _guard(
        user: AppUser = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> AppUser:
        roles = await get_user_roles(user, db)
        if not any(r in allowed_roles for r in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Bu işlem için gereken rol: {', '.join(allowed_roles)}",
            )
        return user

    return _guard


async def require_verified_seller(
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    from app.services.seller_service import get_seller_profile_by_user_id  # local import: circular import'u önler

    roles = await get_user_roles(user, db)
    if "admin" in roles:
        return user

    if "seller" not in roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu işlem için satıcı rolü gerekli")

    profile = await get_seller_profile_by_user_id(db, user.user_id)
    if profile is None or not profile.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Satıcı hesabınız henüz onaylanmadı")

    return user
