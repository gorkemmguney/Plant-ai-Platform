from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.catalog import Prod
from app.models.communication import CommAttachment, CommInteraction, CommMessage
from app.models.user import AppUser
from app.models.customer import Ind, Org
from app.schemas.communication import (
    CommInteractionOut,
    CommInteractionStart,
    CommMessageCreate,
    CommMessageOut,
)

router = APIRouter(prefix="/communication", tags=["communication"])


async def _get_user_name(user: AppUser | None, db: AsyncSession) -> str:
    if not user:
        return "Bilinmeyen Kullanıcı"
    
    ind_res = await db.execute(select(Ind).where(Ind.user_id == user.user_id))
    ind = ind_res.scalar_one_or_none()
    if ind:
        return f"{ind.first_name or ''} {ind.last_name or ''}".strip() or ind.username or "Bilinmeyen Kullanıcı"
        
    org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
    org = org_res.scalar_one_or_none()
    if org:
        return org.store_name or org.company_name or "Bilinmeyen Kullanıcı"
    
    return "Bilinmeyen Kullanıcı"


from app.services.notification_service import create_notification


@router.post("/start", response_model=CommInteractionOut, status_code=status.HTTP_201_CREATED)
async def start_communication(
    body: CommInteractionStart,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    TM Forum TMF681: Starts or retrieves an active communication interaction thread with a seller.
    """
    if current_user.user_id == body.seller_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kendi kendinizle mesajlaşma başlatamazsınız."
        )

    # Check partner user exists
    partner_res = await db.execute(select(AppUser).where(AppUser.user_id == body.seller_id))
    partner = partner_res.scalar_one_or_none()
    if not partner:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Kullanıcı bulunamadı.")

    partner_name = await _get_user_name(partner, db)

    # Find existing thread bidirectionally between user1 and user2
    query = select(CommInteraction).where(
        or_(
            (CommInteraction.customer_id == current_user.user_id) & (CommInteraction.seller_id == body.seller_id),
            (CommInteraction.customer_id == body.seller_id) & (CommInteraction.seller_id == current_user.user_id),
        )
    )
    if body.related_ord_id:
        query = query.where(CommInteraction.related_ord_id == body.related_ord_id)
    elif body.related_prod_id:
        query = query.where(CommInteraction.related_prod_id == body.related_prod_id)

    res = await db.execute(query)
    interaction = res.scalars().first()

    if not interaction:
        # Create new interaction thread
        interaction = CommInteraction(
            interaction_type="IN_APP_CHAT",
            status="OPEN",
            channel_type="IN_APP_CHAT",
            subject=body.subject or (f"Sipariş #{body.related_ord_id} Hakkında" if body.related_ord_id else f"Mesajlaşma - {partner_name}"),
            customer_id=current_user.user_id,
            seller_id=body.seller_id,
            related_prod_id=body.related_prod_id,
            related_ord_id=body.related_ord_id,
            last_message_text=body.initial_message or "Sohbet başlatıldı",
            last_message_at=datetime.utcnow(),
        )
        db.add(interaction)
        await db.commit()
        await db.refresh(interaction)
    else:
        # Update thread with related_ord_id if specified and missing/different
        if body.related_ord_id and interaction.related_ord_id != body.related_ord_id:
            interaction.related_ord_id = body.related_ord_id
            if body.subject:
                interaction.subject = body.subject
            db.add(interaction)
            await db.commit()
            await db.refresh(interaction)

    if body.initial_message:
        msg = CommMessage(
            comm_interaction_id=interaction.comm_interaction_id,
            sender_id=current_user.user_id,
            sender_role="USER",
            content=body.initial_message,
            message_state="SENT",
        )
        db.add(msg)
        await db.flush()

        # Send notification to partner user
        sender_name = await _get_user_name(current_user, db)
        if interaction.related_ord_id:
            notif_title = f"Sipariş #{interaction.related_ord_id} — Yeni Mesaj 💬"
            notif_msg = f"{sender_name}: {body.initial_message}"
        else:
            notif_title = "Yeni Mesaj 💬"
            notif_msg = f"{sender_name}: {body.initial_message}"

        target_notify_id = body.seller_id if current_user.user_id != body.seller_id else interaction.customer_id
        await create_notification(db, user_id=target_notify_id, title=notif_title, message=notif_msg)
        await db.commit()

    return await _to_interaction_out(interaction, current_user.user_id, db)


@router.get("/interactions", response_model=list[CommInteractionOut])
async def list_interactions(
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    Lists all active communication interaction threads for the logged-in user (Customer or Seller).
    """
    res = await db.execute(
        select(CommInteraction)
        .where(
            or_(
                CommInteraction.customer_id == current_user.user_id,
                CommInteraction.seller_id == current_user.user_id,
            )
        )
        .order_by(CommInteraction.last_message_at.desc())
    )
    interactions = res.scalars().all()

    result = []
    for item in interactions:
        out = await _to_interaction_out(item, current_user.user_id, db)
        result.append(out)
    return result


@router.get("/interactions/{interaction_id}/messages", response_model=list[CommMessageOut])
async def get_messages(
    interaction_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    Fetch all messages in a thread and mark received messages as READ.
    """
    interaction = await _get_interaction_or_404(interaction_id, current_user.user_id, db)

    # Mark unread messages from partner as READ
    unread_res = await db.execute(
        select(CommMessage).where(
            CommMessage.comm_interaction_id == interaction.comm_interaction_id,
            CommMessage.sender_id != current_user.user_id,
            CommMessage.message_state != "READ",
        )
    )
    unread_msgs = unread_res.scalars().all()
    if unread_msgs:
        now = datetime.utcnow()
        for m in unread_msgs:
            m.message_state = "READ"
            m.read_at = now
        await db.commit()

    # Load messages with selectinload for attachments
    msg_res = await db.execute(
        select(CommMessage)
        .options(selectinload(CommMessage.attachments))
        .where(CommMessage.comm_interaction_id == interaction.comm_interaction_id)
        .order_by(CommMessage.created_at.asc())
    )
    messages = msg_res.scalars().all()

    out_list = []
    for msg in messages:
        sender_res = await db.execute(select(AppUser).where(AppUser.user_id == msg.sender_id))
        sender = sender_res.scalar_one_or_none()

        out_list.append(
            CommMessageOut(
                comm_message_id=msg.comm_message_id,
                comm_interaction_id=msg.comm_interaction_id,
                sender_id=msg.sender_id,
                sender_name=await _get_user_name(sender, db),
                sender_role=msg.sender_role,
                content=msg.content,
                message_state=msg.message_state,
                read_at=msg.read_at,
                created_at=msg.created_at,
                attachments=[att for att in msg.attachments],
            )
        )
    return out_list


@router.post("/interactions/{interaction_id}/messages", response_model=CommMessageOut, status_code=status.HTTP_201_CREATED)
async def send_message(
    interaction_id: int,
    body: CommMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """
    Sends a message within a communication thread.
    """
    interaction = await _get_interaction_or_404(interaction_id, current_user.user_id, db)

    sender_role = "CUSTOMER" if current_user.user_id == interaction.customer_id else "SELLER"

    msg = CommMessage(
        comm_interaction_id=interaction.comm_interaction_id,
        sender_id=current_user.user_id,
        sender_role=sender_role,
        content=body.content.strip(),
        message_state="SENT",
    )
    db.add(msg)
    await db.flush()

    atts = []
    if body.attachment_url:
        att = CommAttachment(
            comm_message_id=msg.comm_message_id,
            attachment_type="IMAGE",
            url=body.attachment_url,
        )
        db.add(att)
        atts.append(att)

    interaction.last_message_text = body.content.strip()
    interaction.last_message_at = datetime.utcnow()

    # Send notification to recipient with order context
    recipient_id = interaction.seller_id if current_user.user_id == interaction.customer_id else interaction.customer_id
    sender_name = await _get_user_name(current_user, db)
    if interaction.related_ord_id:
        notif_title = f"Sipariş #{interaction.related_ord_id} — Yeni Mesaj"
        notif_msg = f"{sender_name} (Sipariş #{interaction.related_ord_id}): {body.content.strip()}"
    else:
        notif_title = "Yeni Mesaj"
        notif_msg = f"{sender_name}: {body.content.strip()}"

    await create_notification(db, user_id=recipient_id, title=notif_title, message=notif_msg)

    await db.commit()
    await db.refresh(msg)

    return CommMessageOut(
        comm_message_id=msg.comm_message_id,
        comm_interaction_id=msg.comm_interaction_id,
        sender_id=msg.sender_id,
        sender_name=await _get_user_name(current_user, db),
        sender_role=msg.sender_role,
        content=msg.content,
        message_state=msg.message_state,
        read_at=msg.read_at,
        created_at=msg.created_at,
        attachments=atts,
    )


async def _get_interaction_or_404(interaction_id: int, user_id: int, db: AsyncSession) -> CommInteraction:
    res = await db.execute(
        select(CommInteraction).where(CommInteraction.comm_interaction_id == interaction_id)
    )
    interaction = res.scalar_one_or_none()
    if not interaction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="İletişim sohbeti bulunamadı.")
    if user_id not in (interaction.customer_id, interaction.seller_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Bu sohbete erişim yetkiniz yok.")
    return interaction


async def _to_interaction_out(item: CommInteraction, current_user_id: int, db: AsyncSession) -> CommInteractionOut:
    # Determine partner user
    partner_id = item.seller_id if current_user_id == item.customer_id else item.customer_id
    partner_res = await db.execute(select(AppUser).where(AppUser.user_id == partner_id))
    partner = partner_res.scalar_one_or_none()
    partner_name = await _get_user_name(partner, db)

    # Product details
    prod_name = None
    prod_image = None
    if item.related_prod_id:
        prod_res = await db.execute(select(Prod).where(Prod.prod_id == item.related_prod_id))
        prod = prod_res.scalar_one_or_none()
        if prod:
            prod_name = prod.name
            prod_image = prod.image_url

    # Calculate unread count
    unread_res = await db.execute(
        select(func.count(CommMessage.comm_message_id)).where(
            CommMessage.comm_interaction_id == item.comm_interaction_id,
            CommMessage.sender_id != current_user_id,
            CommMessage.message_state != "READ",
        )
    )
    unread_count = unread_res.scalar_one() or 0

    return CommInteractionOut(
        comm_interaction_id=item.comm_interaction_id,
        interaction_type=item.interaction_type,
        status=item.status,
        channel_type=item.channel_type,
        subject=item.subject,
        customer_id=item.customer_id,
        seller_id=item.seller_id,
        partner_name=partner_name,
        related_prod_id=item.related_prod_id,
        related_prod_name=prod_name,
        related_prod_image=prod_image,
        related_ord_id=item.related_ord_id,
        last_message_text=item.last_message_text,
        last_message_at=item.last_message_at,
        unread_count=unread_count,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )
