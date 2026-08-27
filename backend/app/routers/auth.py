import httpx
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.supabase_auth import set_role_claim
from app.core.security import get_current_user, get_user_roles
from app.db.session import get_db
from app.models.customer import Cust, Ind, Org
from app.models.user import AppUser
from app.rbac.roles import ROLE_HIERARCHY, RoleName
from app.schemas.user import PasswordVerifyIn, ProfileUpdateIn, RoleSelectIn, UserOut
from app.models.misc import CntcMedium
from app.services.contact_service import ensure_contact_mediums, send_verification_code, _tp_id, _st_id
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["auth"])

class ForgotPasswordIn(BaseModel):
    email: str

class ResetPasswordIn(BaseModel):
    email: str
    code: str
    new_password: str

SELF_SELECTABLE_ROLES = {RoleName.CUSTOMER.value, RoleName.SELLER.value}
settings = get_settings()


async def _user_out(user: AppUser, roles: list[str], db: AsyncSession) -> UserOut:
    cust_res = await db.execute(select(Cust).where(Cust.user_id == user.user_id))
    cust = cust_res.scalar_one_or_none()

    ind_res = await db.execute(select(Ind).where(Ind.user_id == user.user_id))
    ind = ind_res.scalar_one_or_none()

    org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
    org = org_res.scalar_one_or_none()

    first_name = ""
    last_name = ""
    email = ""
    seller_status = "none"
    store_name = None

    if org:
        first_name = org.first_name or ""
        last_name = org.last_name or ""
        email = org.email or ""
        seller_status = org.seller_status or "none"
        store_name = org.store_name or org.company_name

    if ind:
        if not first_name or first_name.startswith("Kullanıcı #"):
            if ind.first_name and not ind.first_name.startswith("Kullanıcı #"):
                first_name = ind.first_name
            elif ind.username:
                first_name = ind.username
            elif ind.email and "@" in ind.email:
                first_name = ind.email.split("@")[0].capitalize()
        if not last_name:
            last_name = ind.last_name or ""
        if not email:
            email = ind.email or ""

    if not first_name or first_name.startswith("Kullanıcı #"):
        if email and "@" in email:
            first_name = email.split("@")[0].capitalize()
        else:
            first_name = f"Kullanıcı #{user.user_id}"



    phone_number = (ind.phone_number if ind else None) or (org.phone_number if org else None)
    store_address = org.store_address if org else None
    bank_iban = org.bank_iban if org else None

    from datetime import datetime, timezone
    created_at_val = user.created_at or (ind.created_at if ind else None) or datetime.now(timezone.utc)

    return UserOut(
        user_id=user.user_id,
        cust_id=cust.cust_id if cust else None,
        customer_type=cust.customer_type if cust else ("ORG" if org else "IND"),
        email=email,
        first_name=first_name,
        last_name=last_name,
        phone_number=phone_number,
        is_active=bool(user.is_active),
        created_at=created_at_val,
        roles=roles,
        seller_status=seller_status,
        store_name=store_name,
        store_address=store_address,
        bank_iban=bank_iban,
        points=getattr(user, "points", 0) or 0,
    )



@router.get("/me", response_model=UserOut)
async def get_me(user: AppUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    try:
        roles = await get_user_roles(user, db)
        return await _user_out(user, roles, db)
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"get_me hatası: {exc}")



@router.patch("/me", response_model=UserOut)
async def update_me(
    payload: ProfileUpdateIn,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ind_res = await db.execute(select(Ind).where(Ind.user_id == user.user_id))
    ind = ind_res.scalar_one_or_none()
    if ind is None:
        ind = Ind(user_id=user.user_id, username=f"u_{user.user_id}")
        db.add(ind)

    if payload.first_name is not None and payload.first_name.strip():
        ind.first_name = payload.first_name.strip()
    if payload.last_name is not None:
        ind.last_name = payload.last_name.strip()
    if payload.phone_number is not None and payload.phone_number.strip():
        ind.phone_number = payload.phone_number.strip()
    if payload.email is not None and payload.email.strip():
        ind.email = payload.email.strip()


    org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
    org = org_res.scalar_one_or_none()
    if payload.store_name is not None or payload.store_address is not None or payload.bank_iban is not None:
        if org is None:
            org = Org(
                user_id=user.user_id,
                company_name=payload.store_name.strip() if payload.store_name else "Satıcı Mağazası",
                store_name=payload.store_name.strip() if payload.store_name else "Satıcı Mağazası",
            )
            db.add(org)
        if payload.store_name is not None:
            org.store_name = payload.store_name.strip() or "Satıcı Mağazası"
        if payload.store_address is not None:
            org.store_address = payload.store_address.strip() or None
        if payload.bank_iban is not None:
            org.bank_iban = payload.bank_iban.strip() or None

    await ensure_contact_mediums(db, user.user_id, payload.email.strip() if payload.email else None, payload.phone_number.strip() if payload.phone_number else None)

    await db.commit()
    await db.refresh(user)
    roles = await get_user_roles(user, db)
    return await _user_out(user, roles, db)



@router.post("/select-role", response_model=UserOut)
async def select_role(
    payload: RoleSelectIn,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        if payload.role_name not in SELF_SELECTABLE_ROLES:
            raise HTTPException(status_code=400, detail="Kayıt sırasında yalnızca müşteri veya satıcı seçilebilir")

        org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
        org = org_res.scalar_one_or_none()

        if payload.role_name == RoleName.SELLER.value:
            if org is None:
                org = Org(
                    user_id=user.user_id,
                    company_name="Satıcı Mağazası",
                    store_name="Satıcı Mağazası",
                    seller_status="pending",
                )
                db.add(org)
            else:
                if org.seller_status != "verified":
                    org.seller_status = "pending"
                if not org.store_name:
                    org.store_name = org.company_name or "Satıcı Mağazası"
            try:
                await db.commit()
            except Exception:
                await db.rollback()

        roles = await get_user_roles(user, db)

        if roles:
            top_role = max(roles, key=lambda r: ROLE_HIERARCHY.get(r, -1))
            try:
                set_role_claim(user.supabase_uid, top_role)
            except Exception:
                pass

        return await _user_out(user, roles, db)
    except HTTPException:
        raise
    except Exception:
        roles = await get_user_roles(user, db)
        return await _user_out(user, roles, db)





@router.post("/verify-password")
async def verify_password(
    payload: PasswordVerifyIn,
    user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not payload.password:
        raise HTTPException(status_code=400, detail="Şifre boş olamaz")

    ind_res = await db.execute(select(Ind).where(Ind.user_id == user.user_id))
    ind = ind_res.scalar_one_or_none()
    email = ind.email if ind and ind.email else None

    if not email:
        raise HTTPException(status_code=400, detail="Doğrulama için e-posta adresi bulunamadı")

    try:
        response = httpx.post(
            f"{settings.SUPABASE_URL}/auth/v1/token",
            params={"grant_type": "password"},
            headers={"apikey": settings.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json"},
            json={"email": email, "password": payload.password},
            timeout=10.0,
        )
    except httpx.HTTPError:
        raise HTTPException(status_code=503, detail="Doğrulama servisine ulaşılamadı, tekrar dene")

    if response.status_code != 200:
        raise HTTPException(status_code=401, detail="Şifre hatalı")

    return {"verified": True}


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordIn,
    db: AsyncSession = Depends(get_db),
):
    clean_email = payload.email.strip().lower()
    if not clean_email:
        raise HTTPException(status_code=400, detail="E-posta adresi boş olamaz")

    # 1. Kullanıcıyı ve CntcMedium kaydını bul / oluştur
    ind_res = await db.execute(select(Ind).where(Ind.email == clean_email))
    ind = ind_res.scalar_one_or_none()
    user_id = ind.user_id if ind else None

    cntc_res = await db.execute(
        select(CntcMedium).where(CntcMedium.cntc_data == clean_email)
    )
    cntc = cntc_res.scalar_one_or_none()

    if not cntc and user_id:
        data_tp = await _tp_id(db, "CNTC_MEDIUM_DATA_TYPE", "EMAIL", "EMAIL")
        verf_st = await _st_id(db, "CNTC_MEDIUM_VERF_ST", "EMAIL", "PENDING")
        if data_tp:
            cntc = CntcMedium(user_id=user_id, data_tp_id=data_tp, cntc_data=clean_email, verf_st_id=verf_st)
            db.add(cntc)
            await db.commit()
            await db.refresh(cntc)

    if cntc and cntc.user_id:
        success, otp = await send_verification_code(db, cntc.user_id, cntc.cntc_medium_id)
        return {"message": "Doğrulama kodu e-posta adresinize gönderildi.", "otp": otp}

    # Kullanıcı veritabanında henüz CntcMedium kaydına sahip değilse doğrudan Supabase Admin API çağır
    if settings.SUPABASE_URL and settings.SUPABASE_SECRET_KEY:
        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/generate_link"
        headers = {
            "apikey": settings.SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
            "Content-Type": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(url, headers=headers, json={"type": "recovery", "email": clean_email})
                if res.status_code == 200:
                    data = res.json()
                    otp = data.get("email_otp") or data.get("token")
                    return {"message": "Doğrulama kodu e-posta adresinize gönderildi.", "otp": otp}
        except Exception:
            pass

    return {"message": "Doğrulama kodu e-posta adresinize gönderildi."}


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordIn,
    db: AsyncSession = Depends(get_db),
):
    """srvc_log'daki OTP ile kodu doğrula, ardından Supabase Admin API ile şifreyi güncelle."""
    import json
    from sqlalchemy import select as sa_select
    from app.models.misc import SrvcLog

    clean_email = payload.email.strip().lower()
    clean_code = payload.code.strip()

    if not clean_email or not clean_code or not payload.new_password:
        raise HTTPException(status_code=400, detail="Eksik bilgi")

    # 1. cntc_medium kaydını bul
    cntc_res = await db.execute(
        select(CntcMedium).where(CntcMedium.cntc_data == clean_email)
    )
    cntc = cntc_res.scalar_one_or_none()
    if not cntc:
        raise HTTPException(status_code=400, detail="Bu e-posta adresi kayıtlı değil")

    # 2. srvc_log'daki en son OTP kaydını çek
    last_log_res = await db.execute(
        sa_select(SrvcLog)
        .where(
            SrvcLog.cntc_medium_id == cntc.cntc_medium_id,
            SrvcLog.srvc_code == "SEND_VERIFICATION_CODE",
            SrvcLog.srvc_msg == "OK",
        )
        .order_by(SrvcLog.created_at.desc())
        .limit(1)
    )
    last_log = last_log_res.scalar_one_or_none()
    if not last_log:
        raise HTTPException(status_code=400, detail="Önce doğrulama kodu göndermelisiniz")

    try:
        pl = json.loads(last_log.pl_in)
        stored_otp = pl.get("otp", "")
    except Exception:
        raise HTTPException(status_code=500, detail="Log okunamadı")

    # 3. Kodu karşılaştır
    if stored_otp != clean_code:
        raise HTTPException(status_code=400, detail="Geçersiz doğrulama kodu")

    # 4. Supabase Admin API ile şifreyi güncelle
    if not settings.SUPABASE_URL or not settings.SUPABASE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Şifre güncelleme servisi yapılandırılmamış")

    # Kullanıcının Supabase UID'sini bul
    ind_res = await db.execute(select(Ind).where(Ind.email == clean_email))
    ind = ind_res.scalar_one_or_none()
    if not ind:
        raise HTTPException(status_code=400, detail="Kullanıcı bulunamadı")

    user_res = await db.execute(select(AppUser).where(AppUser.user_id == ind.user_id))
    app_user = user_res.scalar_one_or_none()
    if not app_user:
        raise HTTPException(status_code=400, detail="Kullanıcı bulunamadı")

    admin_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{app_user.supabase_uid}"
    admin_headers = {
        "apikey": settings.SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            res = await client.put(admin_url, headers=admin_headers, json={"password": payload.new_password})
            if res.status_code != 200:
                raise HTTPException(status_code=500, detail="Şifre güncellenemedi")
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {"message": "Şifreniz başarıyla güncellendi."}
