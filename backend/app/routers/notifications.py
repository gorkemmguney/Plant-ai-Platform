from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.misc import Notification
from app.models.user import AppUser
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=list[NotificationOut])
async def list_notifications(db: AsyncSession = Depends(get_db), user: AppUser = Depends(get_current_user)):
    result = await db.execute(
        select(Notification).where(Notification.user_id == user.user_id).order_by(Notification.created_at.desc())
    )
    return result.scalars().all()


@router.post("/{notification_id}/read")
async def mark_as_read(notification_id: int, db: AsyncSession = Depends(get_db), user: AppUser = Depends(get_current_user)):
    await db.execute(
        update(Notification)
        .where(Notification.notification_id == notification_id, Notification.user_id == user.user_id)
        .values(is_read=True)
    )
    await db.commit()
    return {"detail": "Okundu olarak işaretlendi"}
