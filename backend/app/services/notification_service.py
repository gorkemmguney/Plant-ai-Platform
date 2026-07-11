from sqlalchemy.ext.asyncio import AsyncSession

from app.models.misc import Notification


async def create_notification(db: AsyncSession, user_id: int, title: str, message: str) -> Notification:
    notification = Notification(user_id=user_id, title=title, message=message)
    db.add(notification)
    await db.flush()
    return notification
