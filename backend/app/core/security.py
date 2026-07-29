
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.supabase_auth import InvalidTokenError, verify_id_token
from app.db.session import get_db
from app.models.user import AppUser, Role, UserRole

bearer_scheme = HTTPBearer(auto_error=True)
settings = get_settings()


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
    user_metadata = decoded.get("user_metadata") or {}
    first_name = user_metadata.get("first_name", "")
    last_name = user_metadata.get("last_name", "")
    if not first_name and user_metadata.get("full_name"):
        first_name, _, last_name = user_metadata["full_name"].partition(" ")

    result = await db.execute(select(AppUser).where(AppUser.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()

    if user is None:
        email_result = await db.execute(select(AppUser).where(AppUser.email == email))
        existing_user = email_result.scalar_one_or_none()

        default_name = (email.split("@")[0].capitalize() if email and "@" in email else "Bitki Sever")
        if existing_user is not None:
            existing_user.firebase_uid = firebase_uid
            if not existing_user.first_name or existing_user.first_name.lower() in ("isimsiz", "i̇simsiz"):
                existing_user.first_name = first_name or default_name
            if not existing_user.last_name:
                existing_user.last_name = last_name or ""
            await db.commit()
            await db.refresh(existing_user)
            user = existing_user
        else:
            user = AppUser(
                firebase_uid=firebase_uid,
                email=email,
                first_name=first_name or default_name,
                last_name=last_name or "",
                is_active=True,
            )
            db.add(user)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                result = await db.execute(select(AppUser).where(AppUser.firebase_uid == firebase_uid))
                user = result.scalar_one()
            else:
                default_role = await db.execute(select(Role).where(Role.role_name == settings.DEFAULT_ROLE))
                role_obj = default_role.scalar_one_or_none()
                if role_obj:
                    db.add(UserRole(user_id=user.user_id, role_id=role_obj.role_id))
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


async def resolve_role_id(user: AppUser, db: AsyncSession, priority: list[str]) -> int:
    # bsn_inter gibi loglarda "kullanıcı hangi sıfatla işlem yaptı" sorusuna cevap üretir.
    # Aynı kullanıcının birden fazla rolü olabilir (ör. hem customer hem seller) — bu
    # durumda `priority` listesindeki sıraya göre, kullanıcının GERÇEKTEN sahip olduğu
    # ilk rol seçilir. Çağıran endpoint zaten require_role ile bu roller arasından
    # birini zorunlu kıldığı için burada en az biri eşleşir.
    user_roles = set(await get_user_roles(user, db))
    for role_name in priority:
        if role_name in user_roles:
            result = await db.execute(select(Role.role_id).where(Role.role_name == role_name))
            role_id = result.scalar_one_or_none()
            if role_id is not None:
                return role_id
    raise HTTPException(status_code=400, detail="Kullanıcının bu işlem için uygun bir rolü bulunamadı")
