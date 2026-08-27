"""Kayıt sırasında kullanıcının email/telefon bilgilerini cntc_medium tablosuna,
doğrulama alanlarıyla birlikte yazan yardımcılar. Lookup id'leri (gnl_tp/gnl_st)
statik seed satırları olduğu için modül seviyesinde cache'lenir."""

import json
import random

import httpx
import resend
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.catalog import GnlSt, GnlTp
from app.models.misc import CntcMedium, SrvcLog

settings = get_settings()
resend.api_key = settings.RESEND_API_KEY

_lookup_cache: dict[str, int] = {}


async def _tp_id(db: AsyncSession, ent_code_name: str, ent_name: str, shrt_code: str) -> int | None:
    key = f"tp:{ent_code_name}:{ent_name}:{shrt_code}"
    if key not in _lookup_cache:
        val = (
            await db.execute(
                select(GnlTp.gnl_tp_id).where(
                    GnlTp.ent_code_name == ent_code_name,
                    GnlTp.ent_name == ent_name,
                    GnlTp.shrt_code == shrt_code,
                )
            )
        ).scalar_one_or_none()
        if val is None:
            return None
        _lookup_cache[key] = val
    return _lookup_cache[key]


async def _st_id(db: AsyncSession, ent_code_name: str, ent_name: str, shrt_code: str) -> int | None:
    key = f"st:{ent_code_name}:{ent_name}:{shrt_code}"
    if key not in _lookup_cache:
        val = (
            await db.execute(
                select(GnlSt.gnl_st_id).where(
                    GnlSt.ent_code_name == ent_code_name,
                    GnlSt.ent_name == ent_name,
                    GnlSt.shrt_code == shrt_code,
                )
            )
        ).scalar_one_or_none()
        if val is None:
            return None
        _lookup_cache[key] = val
    return _lookup_cache[key]


async def ensure_contact_mediums(
    db: AsyncSession, user_id: int, email: str | None, phone: str | None
) -> None:
    """Email ve telefon için birer cntc_medium satırı oluşturur (yoksa).
    Doğrulama durumu başlangıçta 'Doğrulama Bekleniyor' (PENDING) olur.
    Aynı tipten satır zaten varsa tekrar eklemez."""
    if not email and not phone:
        return

    existing = set(
        (
            await db.execute(select(CntcMedium.data_tp_id).where(CntcMedium.user_id == user_id))
        ).scalars().all()
    )

    if email:
        data_tp = await _tp_id(db, "CNTC_MEDIUM_DATA_TYPE", "EMAIL", "EMAIL")
        if data_tp and data_tp not in existing:
            verf_st = await _st_id(db, "CNTC_MEDIUM_VERF_ST", "EMAIL", "PENDING")
            db.add(
                CntcMedium(
                    user_id=user_id,
                    data_tp_id=data_tp,
                    cntc_data=email[:255],
                    verf_st_id=verf_st,
                )
            )

    if phone:
        data_tp = await _tp_id(db, "CNTC_MEDIUM_DATA_TYPE", "GSM", "GSM")
        if data_tp and data_tp not in existing:
            verf_st = await _st_id(db, "CNTC_MEDIUM_VERF_ST", "GSM", "PENDING")
            db.add(
                CntcMedium(
                    user_id=user_id,
                    data_tp_id=data_tp,
                    cntc_data=phone[:255],
                    verf_st_id=verf_st,
                )
            )


async def send_verification_code(
    db: AsyncSession, user_id: int, cntc_medium_id: int
) -> tuple[bool, str | None]:
    """Resend üzerinden e-posta doğrulama kodu gönderir.
    Üretilen OTP kodu srvc_log tablosuna kaydedilir — tam izlenebilirlik sağlar."""

    cntc = (
        await db.execute(
            select(CntcMedium).where(
                CntcMedium.cntc_medium_id == cntc_medium_id,
                CntcMedium.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not cntc:
        return False, None

    is_email = "@" in cntc.cntc_data
    http_status = 500
    otp: str | None = None
    res_data: dict = {}

    # 8 haneli OTP üret
    otp = str(random.randint(10000000, 99999999))

    if is_email and settings.RESEND_API_KEY:
        try:
            # Resend API ile güzel HTML e-posta gönder
            result = resend.Emails.send({
                "from": "Plant AI <onboarding@resend.dev>",
                "to": [cntc.cntc_data],
                "subject": "Doğrulama Kodunuz — Plant AI",
                "html": f"""
                <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 32px; background: #f9fafb; border-radius: 12px;">
                    <h2 style="color: #1a7a4a; margin-bottom: 8px;">🌿 Plant AI</h2>
                    <p style="color: #374151; font-size: 16px;">Merhaba,</p>
                    <p style="color: #374151; font-size: 16px;">Şifre sıfırlama kodunuz aşağıdadır:</p>
                    <div style="background: #ffffff; border: 2px solid #1a7a4a; border-radius: 10px; padding: 24px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #1a7a4a;">{otp}</span>
                    </div>
                    <p style="color: #6b7280; font-size: 14px;">Bu kod 1 saat geçerlidir. Eğer bu isteği siz yapmadıysanız bu e-postayı görmezden gelebilirsiniz.</p>
                    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
                    <p style="color: #9ca3af; font-size: 12px;">Plant AI Platform &mdash; Güvenli Doğrulama Sistemi</p>
                </div>
                """,
            })
            # Resend SDK hata durumunda exception fırlatmaz, dict içinde "error" alanı döner
            if isinstance(result, dict) and result.get("error"):
                http_status = 500
                res_data = {"error": result["error"]}
            else:
                http_status = 200
                res_data = {"id": result.get("id", "") if isinstance(result, dict) else str(result), "provider": "resend"}
        except Exception as exc:
            http_status = 500
            res_data = {"error": str(exc)}
    elif not is_email:
        # SMS için mock
        http_status = 200
        res_data = {"status": "success", "message_id": f"mock_{otp}"}

    # srvc_log'a kaydet — "otp" alanı maile gönderilen GERÇEK kodun ta kendisi
    log_entry = SrvcLog(
        srvc_name="RESEND_EMAIL" if is_email else "MOCK_SMS",
        srvc_code="SEND_VERIFICATION_CODE",
        user_id=user_id,
        cntc_medium_id=cntc_medium_id,
        pl_in=json.dumps({"to": cntc.cntc_data, "otp": otp}),
        pl_out=json.dumps(res_data),
        srvc_msg="OK" if http_status == 200 else "ERROR",
        http_status=http_status,
        cost=0.00,
    )
    db.add(log_entry)

    # Doğrulama tipini belirle (gnl_tp)
    verf_tp_ent_name = "EMAIL" if is_email else "GSM"
    verf_tp_code = "OTP_CODE" if is_email else "SMS_OTP"
    verf_tp = await _tp_id(db, "CNTC_MEDIUM_VERF_TYPE", verf_tp_ent_name, verf_tp_code)
    if verf_tp:
        cntc.verf_tp_id = verf_tp

    await db.commit()
    return http_status == 200, otp


async def verify_code(
    db: AsyncSession, user_id: int, cntc_medium_id: int, code: str
) -> bool:
    """Gönderilen OTP kodunu srvc_log'daki kayıtlı kod ile karşılaştırarak doğrular.
    Başarılıysa CntcMedium statüsü VERIFIED olarak güncellenir."""

    cntc = (
        await db.execute(
            select(CntcMedium).where(
                CntcMedium.cntc_medium_id == cntc_medium_id,
                CntcMedium.user_id == user_id,
            )
        )
    ).scalar_one_or_none()

    if not cntc:
        return False

    is_email = "@" in cntc.cntc_data
    clean_code = code.strip()

    # En son gönderilen OTP kaydını srvc_log'dan çek
    last_log = (
        await db.execute(
            select(SrvcLog)
            .where(
                SrvcLog.cntc_medium_id == cntc_medium_id,
                SrvcLog.srvc_code == "SEND_VERIFICATION_CODE",
                SrvcLog.srvc_msg == "OK",
            )
            .order_by(SrvcLog.created_at.desc())
            .limit(1)
        )
    ).scalar_one_or_none()

    if not last_log:
        return False

    try:
        pl = json.loads(last_log.pl_in)
        stored_otp = pl.get("otp", "")
    except Exception:
        return False

    if stored_otp != clean_code:
        return False

    # Doğrulama başarılı — statüyü güncelle
    verf_st_ent_name = "EMAIL" if is_email else "GSM"
    verf_st = await _st_id(db, "CNTC_MEDIUM_VERF_ST", verf_st_ent_name, "VERIFIED")
    if verf_st:
        cntc.verf_st_id = verf_st
        await db.commit()
    return True
