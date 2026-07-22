import json
from typing import Optional

import google.generativeai as genai
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import get_settings
from app.core.security import get_current_user
from app.core.storage import upload_image
from app.db.session import get_db
from app.models.community import CommunityComment, CommunityLike, CommunityPost
from app.models.user import AppUser
from app.schemas.community import CommunityCommentCreate, CommunityCommentOut, CommunityPostOut

settings = get_settings()
genai.configure(api_key=settings.GEMINI_API_KEY)

router = APIRouter(prefix="/community", tags=["community"])

_COMMUNITY_AI_SYSTEM_PROMPT = """Sen Plant AI platformunun resmi 'AI Uzmanı' ve botanikçisisin.
Kullanıcının paylaştığı bitki gönderisini, sorusunu veya görselini değerlendir.
Kullanıcıya nazik, samimi ve teknik olarak doğru öneriler ver.
Eğer gönderide bir hastalık veya sorun belirtilmişse, teşhis koy ve pratik tedavi yöntemleri yaz.
Eğer bakım sorusuysa, ışık, sulama ve toprak tavsiyeleri ver.
Yanıtını kısa, anlaşılır ve Türkçe olarak yaz. Yanıtına uygun bitki emojileri ekle."""


async def _generate_ai_comment(title: str, content: str, image_bytes: Optional[bytes] = None, mime_type: Optional[str] = None) -> str:
    try:
        if image_bytes and mime_type:
            model = genai.GenerativeModel(settings.GEMINI_VISION_MODEL)
            prompt = f"{_COMMUNITY_AI_SYSTEM_PROMPT}\n\nGönderi Başlığı: {title}\nGönderi İçeriği: {content}\nLütfen ekteki görseli ve metni analiz edip bir uzman yorumu yap."
            response = model.generate_content([prompt, {"mime_type": mime_type, "data": image_bytes}])
            return response.text
        else:
            model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL, system_instruction=_COMMUNITY_AI_SYSTEM_PROMPT)
            prompt = f"Gönderi Başlığı: {title}\nGönderi İçeriği: {content}\nLütfen uzman görüşünü belirt."
            response = model.generate_content(prompt)
            return response.text
    except Exception as e:
        print(f"⚠️ Community AI Comment Generation Error: {e}")
        return "Merhaba! 🌿 Paylaşımınız için teşekkürler. Bitkinizin bakımı ve sağlığı ile ilgili detaylı bilgi almak için harika bir gönderi oluşturmuşsunuz. Topluluk üyelerimizin önerilerini de takip etmenizi tavsiye ederim!"


def _format_author_name(user: Optional[AppUser]) -> str:
    if not user:
        return "Anonim Kullanıcı"
    
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    
    if not first or first.lower() in ("isimsiz", "i̇simsiz", "unnamed"):
        if user.store_name and user.store_name.strip():
            return user.store_name.strip()
        if user.email and "@" in user.email:
            return user.email.split("@")[0].capitalize()
        return "Bitki Sever"
    
    full = f"{first} {last}".strip()
    return full


@router.get("/posts", response_model=list[CommunityPostOut])
async def list_posts(
    tag: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    query = (
        select(CommunityPost)
        .options(selectinload(CommunityPost.user), selectinload(CommunityPost.likes), selectinload(CommunityPost.comments))
        .order_by(CommunityPost.created_at.desc())
    )
    if tag and tag != "all":
        query = query.where(CommunityPost.tag == tag)

    result = await db.execute(query)
    posts = result.scalars().all()

    out_list = []
    for p in posts:
        liked_by_me = any(like.user_id == current_user.user_id for like in p.likes)
        out_list.append(
            CommunityPostOut(
                post_id=p.post_id,
                user_id=p.user_id,
                author_name=_format_author_name(p.user),
                title=p.title,
                content=p.content,
                image_url=p.image_url,
                tag=p.tag,
                ask_ai=p.ask_ai,
                like_count=len(p.likes),
                comment_count=len(p.comments),
                is_liked_by_me=liked_by_me,
                created_at=p.created_at,
                updated_at=p.updated_at,
            )
        )
    return out_list


@router.post("/posts", response_model=CommunityPostOut)
async def create_post(
    title: str = Form(...),
    content: str = Form(...),
    tag: str = Form("general"),
    ask_ai: bool = Form(False),
    file: Optional[UploadFile] = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    image_url = None
    file_bytes = None
    mime_type = None

    if file:
        file_bytes = await file.read()
        mime_type = file.content_type or "image/jpeg"
        try:
            image_url = upload_image(file_bytes, mime_type, folder="community")
        except Exception as e:
            print(f"⚠️ Image upload error: {e}")

    post = CommunityPost(
        user_id=current_user.user_id,
        title=title.strip(),
        content=content.strip(),
        image_url=image_url,
        tag=tag,
        ask_ai=ask_ai,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)

    # Otomatik AI Uzmanı Yorumu (Eğer ask_ai True ise veya etiket 'disease' ise)
    if ask_ai or tag == "disease":
        ai_comment_text = await _generate_ai_comment(title, content, file_bytes, mime_type)
        ai_comment = CommunityComment(
            post_id=post.post_id,
            user_id=None,
            content=ai_comment_text,
            is_ai_reply=True,
        )
        db.add(ai_comment)
        await db.commit()

    # Re-fetch post with relationships
    res = await db.execute(
        select(CommunityPost)
        .options(selectinload(CommunityPost.user), selectinload(CommunityPost.likes), selectinload(CommunityPost.comments))
        .where(CommunityPost.post_id == post.post_id)
    )
    fetched = res.scalar_one()

    return CommunityPostOut(
        post_id=fetched.post_id,
        user_id=fetched.user_id,
        author_name=_format_author_name(fetched.user),
        title=fetched.title,
        content=fetched.content,
        image_url=fetched.image_url,
        tag=fetched.tag,
        ask_ai=fetched.ask_ai,
        like_count=len(fetched.likes),
        comment_count=len(fetched.comments),
        is_liked_by_me=False,
        created_at=fetched.created_at,
        updated_at=fetched.updated_at,
    )


@router.post("/posts/{post_id}/like")
async def toggle_like(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    post_res = await db.execute(select(CommunityPost).where(CommunityPost.post_id == post_id))
    post = post_res.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gönderi bulunamadı")

    like_res = await db.execute(
        select(CommunityLike).where(CommunityLike.post_id == post_id, CommunityLike.user_id == current_user.user_id)
    )
    existing_like = like_res.scalar_one_or_none()

    if existing_like:
        await db.delete(existing_like)
        await db.commit()
        is_liked = False
    else:
        new_like = CommunityLike(post_id=post_id, user_id=current_user.user_id)
        db.add(new_like)
        await db.commit()
        is_liked = True

    count_res = await db.execute(select(func.count(CommunityLike.like_id)).where(CommunityLike.post_id == post_id))
    like_count = count_res.scalar_one()

    return {"is_liked_by_me": is_liked, "like_count": like_count}


@router.get("/posts/{post_id}/comments", response_model=list[CommunityCommentOut])
async def list_comments(
    post_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(get_current_user),
):
    query = (
        select(CommunityComment)
        .options(selectinload(CommunityComment.user))
        .where(CommunityComment.post_id == post_id)
        .order_by(CommunityComment.created_at.asc())
    )
    res = await db.execute(query)
    comments = res.scalars().all()

    out = []
    for c in comments:
        name = "AI Uzmanı 🌿" if c.is_ai_reply else _format_author_name(c.user)
        out.append(
            CommunityCommentOut(
                comment_id=c.comment_id,
                post_id=c.post_id,
                user_id=c.user_id,
                author_name=name,
                content=c.content,
                is_ai_reply=c.is_ai_reply,
                created_at=c.created_at,
            )
        )
    return out


@router.post("/posts/{post_id}/comments", response_model=CommunityCommentOut)
async def add_comment(
    post_id: int,
    payload: CommunityCommentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    post_res = await db.execute(select(CommunityPost).where(CommunityPost.post_id == post_id))
    post = post_res.scalar_one_or_none()
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gönderi bulunamadı")

    comment = CommunityComment(
        post_id=post_id,
        user_id=current_user.user_id,
        content=payload.content.strip(),
        is_ai_reply=False,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    return CommunityCommentOut(
        comment_id=comment.comment_id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        author_name=_format_author_name(current_user),
        content=comment.content,
        is_ai_reply=False,
        created_at=comment.created_at,
    )
