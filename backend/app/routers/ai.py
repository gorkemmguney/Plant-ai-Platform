import json
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.core.storage import upload_image
from app.db.session import get_db
from app.models.ai import AiChat, AiFeedback, AiImageAnalysis, AiMessage
from app.models.user import AppUser
from app.schemas.ai import ChatMessageIn, ChatMessageOut, ChatSessionOut, FeedbackIn, ImageAnalysisOut
from app.services.ai_service import analyze_plant_image, chat_reply

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/analyze-image", response_model=ImageAnalysisOut)
async def analyze_image(
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    image_bytes = await file.read()
    image_url = upload_image(image_bytes, file.content_type or "image/jpeg")
    
    analysis = await analyze_plant_image(image_bytes, file.content_type or "image/jpeg")

    record = AiImageAnalysis(
        user_id=user.user_id,
        image_url=image_url,
        result=json.dumps(analysis),
        confidence=analysis.get("confidence"),
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    recommended = analysis.get("recommended_products", [])

    return {
        "analysis_id": record.analysis_id,
        "image_url": record.image_url,
        "result": record.result,
        "confidence": record.confidence,
        "created_at": record.created_at,
        "recommended_products": recommended,
    }


@router.get("/analyses", response_model=list[ImageAnalysisOut])
async def list_my_analyses(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    result = await db.execute(
        select(AiImageAnalysis)
        .where(AiImageAnalysis.user_id == user.user_id)
        .order_by(AiImageAnalysis.created_at.desc())
    )
    return result.scalars().all()


@router.get("/chats", response_model=list[ChatSessionOut])
async def list_my_chats(
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    """Kullanıcının geçmiş sohbet oturumlarını, en son mesajı yeni olan üstte, listeler."""
    chats = (
        await db.execute(
            select(AiChat).where(AiChat.user_id == user.user_id).order_by(AiChat.created_at.desc())
        )
    ).scalars().all()

    sessions: list[ChatSessionOut] = []
    for chat in chats:
        stats = (
            await db.execute(
                select(func.count(AiMessage.ai_message_id), func.max(AiMessage.created_at))
                .where(AiMessage.ai_chat_id == chat.ai_chat_id)
            )
        ).first()
        count, last_at = stats if stats else (0, None)

        # Önizleme: bu oturumdaki ilk kullanıcı mesajı
        first_user_msg = (
            await db.execute(
                select(AiMessage.message)
                .where(AiMessage.ai_chat_id == chat.ai_chat_id, AiMessage.role == "user")
                .order_by(AiMessage.created_at)
                .limit(1)
            )
        ).scalar_one_or_none()

        # Boş (hiç mesaj yazılmamış) oturumları listede gösterme
        if not count:
            continue

        preview = (first_user_msg[:80] + "…") if first_user_msg and len(first_user_msg) > 80 else first_user_msg
        sessions.append(
            ChatSessionOut(
                ai_chat_id=chat.ai_chat_id,
                created_at=chat.created_at,
                last_message_at=last_at,
                preview=preview,
                message_count=count or 0,
            )
        )

    return sessions


@router.get("/chats/{chat_id}/messages", response_model=list[ChatMessageOut])
async def get_chat_messages(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    chat = (await db.execute(select(AiChat).where(AiChat.ai_chat_id == chat_id))).scalar_one_or_none()
    if chat is None or chat.user_id != user.user_id:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")

    messages = (
        await db.execute(
            select(AiMessage).where(AiMessage.ai_chat_id == chat_id).order_by(AiMessage.created_at)
        )
    ).scalars().all()
    return messages


@router.delete("/chats/{chat_id}")
async def delete_chat(
    chat_id: int,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    chat = (await db.execute(select(AiChat).where(AiChat.ai_chat_id == chat_id))).scalar_one_or_none()
    if chat is None or chat.user_id != user.user_id:
        raise HTTPException(status_code=404, detail="Sohbet bulunamadı")

    await db.execute(delete(AiMessage).where(AiMessage.ai_chat_id == chat_id))
    await db.execute(delete(AiChat).where(AiChat.ai_chat_id == chat_id))
    await db.commit()
    return {"detail": "Sohbet silindi"}


@router.post("/chat", response_model=ChatMessageOut)
async def send_chat_message(
    payload: ChatMessageIn,
    db: AsyncSession = Depends(get_db),
    user: AppUser = Depends(get_current_user),
):
    if payload.ai_chat_id:
        result = await db.execute(select(AiChat).where(AiChat.ai_chat_id == payload.ai_chat_id))
        chat = result.scalar_one_or_none()
    else:
        chat = AiChat(user_id=user.user_id)
        db.add(chat)
        await db.flush()

    history_result = await db.execute(
        select(AiMessage).where(AiMessage.ai_chat_id == chat.ai_chat_id).order_by(AiMessage.created_at)
    )
    history = [
        {"role": "user" if m.role == "user" else "model", "parts": [m.message]} for m in history_result.scalars().all()
    ]

    db.add(AiMessage(ai_chat_id=chat.ai_chat_id, role="user", message=payload.message))
    await db.flush()

    reply_text = await chat_reply(history, payload.message)

    assistant_message = AiMessage(ai_chat_id=chat.ai_chat_id, role="assistant", message=reply_text)
    db.add(assistant_message)
    await db.commit()
    await db.refresh(assistant_message)
    return assistant_message


@router.post("/feedback")
async def submit_feedback(
    payload: FeedbackIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(get_current_user),
):
    db.add(AiFeedback(**payload.model_dump()))
    await db.commit()
    return {"detail": "Geri bildirim kaydedildi"}
