from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.session import get_db
from app.core.security import get_current_user
from app.models.user import AppUser
from app.models.misc import CntcMedium
from app.services.contact_service import send_verification_code, verify_code

router = APIRouter()

class SendCodeRequest(BaseModel):
    cntc_medium_id: int

class VerifyCodeRequest(BaseModel):
    cntc_medium_id: int
    code: str

@router.post("/send", status_code=status.HTTP_200_OK)
async def send_code(
    req: SendCodeRequest,
    current_user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    success, otp = await send_verification_code(db, current_user.user_id, req.cntc_medium_id)
    if not success:
        raise HTTPException(status_code=400, detail="Doğrulama kodu gönderilemedi. İletişim kanalı bulunamadı.")
    return {
        "message": "Doğrulama kodu başarıyla gönderildi.",
        "otp": otp  # Test/Geliştirme aşamasında kolaylık için yanıt paketinde gösterilir
    }

@router.post("/verify", status_code=status.HTTP_200_OK)
async def verify(
    req: VerifyCodeRequest,
    current_user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    success = await verify_code(db, current_user.user_id, req.cntc_medium_id, req.code)
    if not success:
        raise HTTPException(status_code=400, detail="Geçersiz veya süresi dolmuş doğrulama kodu.")
    return {"message": "İletişim kanalı başarıyla doğrulandı."}

@router.get("/my-channels")
async def get_my_channels(
    current_user: AppUser = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    channels = (
        await db.execute(
            select(CntcMedium).where(CntcMedium.user_id == current_user.user_id)
        )
    ).scalars().all()
    
    return [
        {
            "id": c.cntc_medium_id,
            "data": c.cntc_data,
            "is_verified": c.verf_st_id is not None # Basit kontrol
        }
        for c in channels
    ]
