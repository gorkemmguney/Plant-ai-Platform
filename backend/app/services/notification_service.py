from firebase_admin import messaging
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.misc import Notification


async def send_notification(db: AsyncSession, user_id: int, title: str, message: str, fcm_token: str | None = None) -> Notification:
    record = Notification(user_id=user_id, title=title, message=message, is_read=False)
    db.add(record)
    await db.commit()
    await db.refresh(record)

    if fcm_token:
        try:
            messaging.send(
                messaging.Message(
                    notification=messaging.Notification(title=title, body=message),
                    token=fcm_token,
                )
            )
        except Exception:
            # Push başarısız olsa bile DB kaydı zaten oluşturuldu; loglama eklenmeli
            pass

    return record
