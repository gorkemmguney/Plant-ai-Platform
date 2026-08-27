
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.supabase_auth import InvalidTokenError, verify_id_token
from app.db.session import get_db
from app.models.customer import Cust, Ind, Org

from app.models.user import AppUser, Role, UserRole


bearer_scheme = HTTPBearer(auto_error=True)
settings = get_settings()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> AppUser:
    try:
        decoded = verify_id_token(credentials.credentials)
        print("JWT DECODED:", decoded)
    except InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz veya süresi dolmuş token")

    try:
        supabase_uid = decoded["uid"]
        email = decoded.get("email", "")
        user_metadata = decoded.get("user_metadata") or {}
        first_name = user_metadata.get("first_name", "")
        last_name = user_metadata.get("last_name", "")
        if not first_name and user_metadata.get("full_name"):
            first_name, _, last_name = user_metadata["full_name"].partition(" ")

        result = await db.execute(select(AppUser).where(AppUser.supabase_uid == supabase_uid))
        user = result.scalar_one_or_none()

        if user is None:
            user = AppUser(
                supabase_uid=supabase_uid,
                is_active=True,
            )
            db.add(user)
            try:
                await db.flush()
            except IntegrityError:
                await db.rollback()
                result = await db.execute(select(AppUser).where(AppUser.supabase_uid == supabase_uid))
                user = result.scalar_one()

        user_id_val = user.user_id

        # Ensure Cust profile exists
        cust_check = await db.execute(select(Cust).where(Cust.user_id == user_id_val))
        cust_obj = cust_check.scalar_one_or_none()
        if cust_obj is None:
            cust_obj = Cust(user_id=user_id_val, customer_type="IND", is_active=True)
            db.add(cust_obj)
            try:
                await db.flush()
            except Exception:
                await db.rollback()
                cust_check = await db.execute(select(Cust).where(Cust.user_id == user_id_val))
                cust_obj = cust_check.scalar_one_or_none()

        cust_id_val = cust_obj.cust_id if cust_obj else None

        # Ensure Ind profile exists
        ind_check = await db.execute(select(Ind).where(Ind.user_id == user_id_val))
        ind_profile = ind_check.scalar_one_or_none()
        default_name = (email.split("@")[0].capitalize() if email and "@" in email else "Bitki Sever")
        phone = user_metadata.get("phone_number") or user_metadata.get("phone")

        if ind_profile is None:
            ind_profile = Ind(
                user_id=user_id_val,
                cust_id=cust_id_val,
                username=f"u_{user_id_val}",
                first_name=(first_name or default_name)[:100],
                last_name=(last_name or "")[:100],
                email=email[:255] if email else None,
                phone_number=phone[:30] if phone else None,
            )
            db.add(ind_profile)
            try:
                await db.flush()
            except Exception:
                await db.rollback()
        else:
            updated = False
            if first_name and (not ind_profile.first_name or ind_profile.first_name.startswith("Kullanıcı #") or ind_profile.first_name == "Bitki Sever"):
                ind_profile.first_name = first_name[:100]
                updated = True
            if last_name and not ind_profile.last_name:
                ind_profile.last_name = last_name[:100]
                updated = True

            if email and not ind_profile.email:
                ind_profile.email = email[:255]
                updated = True
            if phone and not ind_profile.phone_number:
                ind_profile.phone_number = phone[:30]
                updated = True
            if updated:
                try:
                    await db.flush()
                except Exception:
                    await db.rollback()

        store_name = user_metadata.get("store_name", "")
        store_address = user_metadata.get("store_address", "")
        bank_iban = user_metadata.get("bank_iban", "")

        if store_name or store_address or bank_iban:
            org_res = await db.execute(select(Org).where(Org.user_id == user_id_val))
            org_profile = org_res.scalar_one_or_none()
            if org_profile is None:
                org_profile = Org(
                    user_id=user_id_val,
                    cust_id=cust_id_val,
                    company_name=(store_name or "Satıcı Mağazası")[:150],
                    store_name=(store_name or "Satıcı Mağazası")[:150],
                    store_address=store_address[:255] if store_address else None,
                    bank_iban=bank_iban[:50] if bank_iban else None,
                    phone_number=phone[:30] if phone else None,
                    email=email[:255] if email else None,
                    first_name=first_name[:100] if first_name else None,
                    last_name=last_name[:100] if last_name else None,
                )
                db.add(org_profile)
                try:
                    await db.flush()
                except Exception:
                    await db.rollback()
            else:
                updated_org = False
                if store_name and not org_profile.store_name:
                    org_profile.store_name = store_name[:150]
                    updated_org = True
                if store_address and not org_profile.store_address:
                    org_profile.store_address = store_address[:255]
                    updated_org = True
                if bank_iban and not org_profile.bank_iban:
                    org_profile.bank_iban = bank_iban[:50]
                    updated_org = True
                if updated_org:
                    try:
                        await db.flush()
                    except Exception:
                        await db.rollback()

        # Kayıt sırasında email/telefon için cntc_medium satırlarını oluştur (doğrulama = Bekliyor).
        # Login akışını asla bozmasın diye ayrı try/except ile sarılı.
        try:
            from app.services.contact_service import ensure_contact_mediums

            eff_email = (ind_profile.email if ind_profile and ind_profile.email else email) or None
            eff_phone = (ind_profile.phone_number if ind_profile and ind_profile.phone_number else phone) or None
            await ensure_contact_mediums(db, user_id_val, eff_email, eff_phone)
        except Exception:
            pass

        # Guarantee user has at least default role
        await get_user_roles(user_id_val, db)


        try:
            await db.commit()
            await db.refresh(user)
        except Exception:
            await db.rollback()

        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Hesap devre dışı bırakılmış")

        return user
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"get_current_user hatası: {exc}")



async def get_user_roles(user: AppUser | int, db: AsyncSession) -> list[str]:
    user_id = user if isinstance(user, int) else getattr(user, "user_id", user)
    result = await db.execute(
        select(Role.role_name).join(UserRole, UserRole.role_id == Role.role_id).where(UserRole.user_id == user_id)
    )
    roles = [r for (r,) in result.all()]
    if not roles:
        default_role = await db.execute(select(Role).where(Role.role_name == settings.DEFAULT_ROLE))
        role_obj = default_role.scalar_one_or_none()
        if role_obj:
            db.add(UserRole(user_id=user_id, role_id=role_obj.role_id))
            try:
                await db.flush()
            except Exception:
                await db.rollback()
            roles = [settings.DEFAULT_ROLE]
    return roles





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
