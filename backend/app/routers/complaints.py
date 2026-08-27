from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, get_user_roles, require_role
from app.db.session import get_db
from app.models.catalog import Prod
from app.models.misc import Notification
from app.models.order import CustOrd
from app.models.complaint import Complaint
from app.models.user import AppUser
from app.models.customer import Ind, Org
from app.rbac.roles import RoleName
from app.schemas.complaint import ComplaintAdminUpdate, ComplaintCreate, ComplaintOut, ComplaintUserReply

router = APIRouter(prefix="/complaints", tags=["complaints"])


STATUS_LABELS = {
    "pending": "Beklemede",
    "in_progress": "İnceleniyor",
    "resolved": "Çözüldü",
    "rejected": "Reddedildi",
}


async def _to_complaint_out(complaint: Complaint, db: AsyncSession) -> ComplaintOut:
    user_name = None
    user_email = None
    reported_seller_name = None
    product_name = None
    order_price = None
    order_date = None

    ind_res = await db.execute(select(Ind).where(Ind.user_id == complaint.user_id))
    ind = ind_res.scalar_one_or_none()
    org_res = await db.execute(select(Org).where(Org.user_id == complaint.user_id))
    org = org_res.scalar_one_or_none()
    
    if ind:
        user_name = f"{ind.first_name or ''} {ind.last_name or ''}".strip() or ind.username
        user_email = ind.email
    elif org:
        user_name = org.store_name or org.company_name
        user_email = org.email
        
    if not user_name:
        user_name = f"Kullanıcı #{complaint.user_id}"

    if complaint.reported_seller_id:
        seller_org_res = await db.execute(select(Org).where(Org.user_id == complaint.reported_seller_id))
        seller_org = seller_org_res.scalar_one_or_none()
        if seller_org:
            reported_seller_name = seller_org.store_name or seller_org.company_name
        else:
            reported_seller_name = f"Satıcı #{complaint.reported_seller_id}"

    if complaint.prod_id:
        prod_res = await db.execute(select(Prod).where(Prod.prod_id == complaint.prod_id))
        prod = prod_res.scalar_one_or_none()
        if prod:
            product_name = prod.name

    if complaint.cust_ord_id:
        ord_res = await db.execute(select(CustOrd).where(CustOrd.cust_ord_id == complaint.cust_ord_id))
        order = ord_res.scalar_one_or_none()
        if order:
            order_price = order.total_price
            order_date = order.order_date

    return ComplaintOut(
        complaint_id=complaint.complaint_id,
        user_id=complaint.user_id,
        complaint_type=complaint.complaint_type,
        source_panel=complaint.source_panel,
        cust_ord_id=complaint.cust_ord_id,
        prod_id=complaint.prod_id,
        reported_seller_id=complaint.reported_seller_id,
        title=complaint.title,
        description=complaint.description,
        status=complaint.status,
        admin_note=complaint.admin_note,
        user_reply=complaint.user_reply,
        sentiment=complaint.sentiment,
        urgency=complaint.urgency,
        ai_summary=complaint.ai_summary,
        ai_tags=complaint.ai_tags,
        created_at=complaint.created_at,
        updated_at=complaint.updated_at,
        user_name=user_name,
        user_email=user_email,
        reported_seller_name=reported_seller_name,
        product_name=product_name,
        order_price=order_price,
        order_date=order_date,
    )


@router.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):

    if payload.cust_ord_id:
        ord_res = await db.execute(select(CustOrd).where(CustOrd.cust_ord_id == payload.cust_ord_id))
        order = ord_res.scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=400, detail="Belirtilen sipariş bulunamadı.")
            
    if payload.prod_id:
        prod_res = await db.execute(select(Prod).where(Prod.prod_id == payload.prod_id))
        product = prod_res.scalar_one_or_none()
        if not product:
            raise HTTPException(status_code=400, detail="Belirtilen ürün bulunamadı.")
            
    if payload.reported_seller_id:
        seller_res = await db.execute(select(AppUser).where(AppUser.user_id == payload.reported_seller_id))
        seller = seller_res.scalar_one_or_none()
        if not seller:
            raise HTTPException(status_code=400, detail="Belirtilen satıcı bulunamadı.")

    from app.services.ai_service import analyze_new_complaint
    ai_res = await analyze_new_complaint(
        title=payload.title,
        description=payload.description,
        complaint_type=payload.complaint_type
    )

    roles = await get_user_roles(current_user, db)
    source_panel = payload.source_panel if payload.source_panel in ("customer", "seller") else "customer"
    if source_panel == "seller" and RoleName.SELLER not in roles and RoleName.ADMIN not in roles:
        raise HTTPException(status_code=403, detail="Satıcı paneli adına talep açma yetkiniz yok.")

    complaint = Complaint(
        user_id=current_user.user_id,
        source_panel=source_panel,
        complaint_type=payload.complaint_type,
        cust_ord_id=payload.cust_ord_id,
        prod_id=payload.prod_id,
        reported_seller_id=payload.reported_seller_id,
        title=payload.title,
        description=payload.description,
        status="pending",
        sentiment=ai_res.get("sentiment", "neutral"),
        urgency=ai_res.get("urgency", "medium"),
        ai_summary=ai_res.get("ai_summary"),
        ai_tags=", ".join(ai_res.get("ai_tags", [])) if isinstance(ai_res.get("ai_tags"), list) else None
    )
    db.add(complaint)
    await db.commit()
    await db.refresh(complaint)

    return await _to_complaint_out(complaint, db)


@router.get("", response_model=list[ComplaintOut])
async def list_my_complaints(
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    res = await db.execute(
        select(Complaint).where(Complaint.user_id == current_user.user_id).order_by(Complaint.created_at.desc())
    )
    complaints = res.scalars().all()
    return [await _to_complaint_out(c, db) for c in complaints]


@router.get("/{complaint_id}", response_model=ComplaintOut)
async def get_my_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    res = await db.execute(
        select(Complaint).where(Complaint.complaint_id == complaint_id)
    )
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Şikayet kaydı bulunamadı.")
    
    roles_res = await db.execute(
        select(AppUser).where(AppUser.user_id == current_user.user_id)
    )
    is_admin = False
    result = await db.execute(
        select(AppUser).where(AppUser.user_id == current_user.user_id)
    )
    if complaint.user_id != current_user.user_id:
        admin_check = await db.execute(
            select(AppUser).join(Notification, False).where(AppUser.user_id == current_user.user_id) # dummy join or reuse logic
        )
        raise HTTPException(status_code=403, detail="Bu şikayet kaydına erişim yetkiniz yok.")
        
    return await _to_complaint_out(complaint, db)


@router.patch("/{complaint_id}/reply", response_model=ComplaintOut)
async def add_user_reply(
    complaint_id: int,
    payload: ComplaintUserReply,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    """Talebi acan kisi ek aciklama ekler. Admin cevap verdikten SONRA kilitlenir."""
    res = await db.execute(select(Complaint).where(Complaint.complaint_id == complaint_id))
    complaint = res.scalar_one_or_none()
    if complaint is None or complaint.user_id != current_user.user_id:
        raise HTTPException(status_code=404, detail="Talep bulunamadı.")
    if complaint.admin_note:
        raise HTTPException(status_code=400, detail="Bu talep yanıtlandı, yeni mesaj ekleyemezsiniz.")
    complaint.user_reply = payload.user_reply
    await db.commit()
    await db.refresh(complaint)
    return await _to_complaint_out(complaint, db)


@router.get("/admin/all", response_model=list[ComplaintOut])
async def admin_list_complaints(
    status_filter: str | None = None,
    source_panel: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    query = select(Complaint)
    if status_filter:
        query = query.where(Complaint.status == status_filter)
    if source_panel in ("customer", "seller"):
        query = query.where(Complaint.source_panel == source_panel)
    query = query.order_by(Complaint.created_at.desc())
    
    res = await db.execute(query)
    complaints = res.scalars().all()
    return [await _to_complaint_out(c, db) for c in complaints]


@router.get("/admin/{complaint_id}", response_model=ComplaintOut)
async def admin_get_complaint(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    res = await db.execute(
        select(Complaint).where(Complaint.complaint_id == complaint_id)
    )
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Şikayet kaydı bulunamadı.")
    return await _to_complaint_out(complaint, db)


@router.patch("/admin/{complaint_id}", response_model=ComplaintOut)
async def admin_update_complaint(
    complaint_id: int,
    payload: ComplaintAdminUpdate,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    res = await db.execute(
        select(Complaint).where(Complaint.complaint_id == complaint_id)
    )
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Şikayet kaydı bulunamadı.")

    status_changed = False
    old_status = complaint.status
    
    if payload.status is not None:
        if payload.status not in ["pending", "in_progress", "resolved", "rejected"]:
            raise HTTPException(status_code=400, detail="Geçersiz şikayet durumu.")
        if complaint.status != payload.status:
            complaint.status = payload.status
            status_changed = True
            
    if payload.admin_note is not None:
        complaint.admin_note = payload.admin_note
        status_changed = True  # send notification on note update too

    if status_changed:
        await db.commit()
        await db.refresh(complaint)
        
        status_label = STATUS_LABELS.get(complaint.status, complaint.status)
        notif_msg = f"'{complaint.title}' başlıklı şikayet/destek talebiniz güncellendi. Yeni Durum: {status_label}."
        if complaint.admin_note:
            notif_msg += f" Yönetici Notu: {complaint.admin_note}"

        notification = Notification(
            user_id=complaint.user_id,
            title="Şikayetiniz Güncellendi",
            message=notif_msg,
            is_read=False
        )
        db.add(notification)
        await db.commit()
    else:
        await db.commit()
        await db.refresh(complaint)

    return await _to_complaint_out(complaint, db)


@router.post("/admin/{complaint_id}/ai-draft")
async def admin_ai_draft_complaint_response(
    complaint_id: int,
    target_status: str,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    res = await db.execute(
        select(Complaint).where(Complaint.complaint_id == complaint_id)
    )
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Şikayet kaydı bulunamadı.")

    if target_status not in ["pending", "in_progress", "resolved", "rejected"]:
        raise HTTPException(
            status_code=400,
            detail="Geçersiz hedef durum. Yapay zeka taslağı sadece 'pending', 'in_progress', 'resolved' veya 'rejected' durumları için oluşturulabilir."
        )

    user_name = None
    user_res = await db.execute(select(AppUser).where(AppUser.user_id == complaint.user_id))
    user = user_res.scalar_one_or_none()
    if user:
        user_name = f"{user.first_name} {user.last_name}".strip()

    product_name = None
    if complaint.prod_id:
        prod_res = await db.execute(select(Prod).where(Prod.prod_id == complaint.prod_id))
        prod = prod_res.scalar_one_or_none()
        if prod:
            product_name = prod.name

    reported_seller_name = None
    if complaint.reported_seller_id:
        seller_res = await db.execute(select(AppUser).where(AppUser.user_id == complaint.reported_seller_id))
        seller = seller_res.scalar_one_or_none()
        if seller:
            reported_seller_name = f"{seller.first_name} {seller.last_name}".strip()

    from app.services.ai_service import generate_complaint_response
    ai_res = await generate_complaint_response(
        complaint_title=complaint.title,
        complaint_description=complaint.description,
        complaint_type=complaint.complaint_type,
        target_status=target_status,
        user_name=user_name,
        product_name=product_name,
        reported_seller_name=reported_seller_name
    )

    return ai_res


@router.get("/admin/{complaint_id}/seller-risk-advisor")
async def admin_get_seller_risk_advice(
    complaint_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    res = await db.execute(
        select(Complaint).where(Complaint.complaint_id == complaint_id)
    )
    complaint = res.scalar_one_or_none()
    if not complaint:
        raise HTTPException(status_code=404, detail="Şikayet kaydı bulunamadı.")

    seller_id = complaint.reported_seller_id
    if not seller_id and complaint.prod_id:
        prod_res = await db.execute(select(Prod).where(Prod.prod_id == complaint.prod_id))
        product = prod_res.scalar_one_or_none()
        if product:
            seller_id = product.seller_id or product.owner_user_id

    if not seller_id:
        raise HTTPException(status_code=400, detail="Bu şikayet kaydı herhangi bir satıcı ile ilişkili değil.")

    seller_res = await db.execute(select(AppUser).where(AppUser.user_id == seller_id))
    seller = seller_res.scalar_one_or_none()
    if not seller:
        raise HTTPException(status_code=404, detail="Şikayet edilen satıcı profili bulunamadı.")
    seller_name = f"{seller.first_name} {seller.last_name}".strip()

    seller_complaints_res = await db.execute(
        select(Complaint).where(
            (Complaint.reported_seller_id == seller_id) |
            (Complaint.prod_id.in_(select(Prod.prod_id).where((Prod.seller_id == seller_id) | (Prod.owner_user_id == seller_id))))
        )
    )
    seller_complaints = seller_complaints_res.scalars().all()
    
    total_cnt = len(seller_complaints)
    pending_cnt = sum(1 for c in seller_complaints if c.status in ["pending", "in_progress"])
    resolved_cnt = sum(1 for c in seller_complaints if c.status == "resolved")
    
    recent_types = list(set(c.complaint_type for c in seller_complaints))
    
    from app.services.ai_service import generate_seller_risk_advice
    risk_advice = await generate_seller_risk_advice(
        seller_name=seller_name,
        total_complaints=total_cnt,
        pending_count=pending_cnt,
        resolved_count=resolved_cnt,
        recent_types=recent_types
    )
    
    return risk_advice

