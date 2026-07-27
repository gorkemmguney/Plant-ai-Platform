from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.customer import Cust
from app.models.customer_product import CustProd
from app.models.misc import Notification
from app.models.user import AppUser
from app.schemas.notification import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])


async def _generate_care_reminders(db: AsyncSession, user: AppUser) -> None:
    """Kullanıcının bahçesinde sulama/gübreleme vakti gelmiş bitkiler için bildirim
    oluşturur. Aynı bildirim aynı gün tekrar üretilmez (mükerrer engellenir)."""
    cust = (await db.execute(select(Cust).where(Cust.user_id == user.user_id))).scalar_one_or_none()
    if cust is None:
        return

    plants = (await db.execute(select(CustProd).where(CustProd.cust_id == cust.cust_id))).scalars().all()
    if not plants:
        return

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    created_any = False

    for p in plants:
        due: list[tuple[str, str]] = []
        if p.last_watered_at and p.watering_interval_days:
            if now >= p.last_watered_at + timedelta(days=p.watering_interval_days):
                due.append(("Sulama zamanı 💧", f"{p.name} sulanmalı — toprak kurudu."))
        if p.last_fertilized_at and p.fertilizing_interval_days:
            if now >= p.last_fertilized_at + timedelta(days=p.fertilizing_interval_days):
                due.append(("Gübreleme zamanı 🌿", f"{p.name} için gübreleme vakti geldi."))

        for title, message in due:
            exists = (
                await db.execute(
                    select(Notification.notification_id)
                    .where(
                        Notification.user_id == user.user_id,
                        Notification.message == message,
                        Notification.created_at >= today_start,
                    )
                    .limit(1)
                )
            ).first()
            if exists is None:
                db.add(Notification(user_id=user.user_id, title=title, message=message))
                created_any = True

    if created_any:
        await db.commit()


@router.get("", response_model=list[NotificationOut])
async def list_notifications(db: AsyncSession = Depends(get_db), user: AppUser = Depends(get_current_user)):
    # Listeyi dönmeden önce vakti gelmiş bakım hatırlatmalarını üret
    await _generate_care_reminders(db, user)
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
