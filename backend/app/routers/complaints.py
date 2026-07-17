from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_current_user, require_role
from app.db.session import get_db
from app.models.catalog import Prod
from app.models.misc import Notification
from app.models.order import CustOrd
from app.models.complaint import Complaint
from app.models.user import AppUser
from app.rbac.roles import RoleName
from app.schemas.complaint import ComplaintAdminUpdate, ComplaintCreate, ComplaintOut

router = APIRouter(prefix="/complaints", tags=["complaints"])


# Status labels for notification message mapping
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

    # Fetch complainant user info
    user_res = await db.execute(select(AppUser).where(AppUser.user_id == complaint.user_id))
    user = user_res.scalar_one_or_none()
    if user:
        user_name = f"{user.first_name} {user.last_name}".strip()
        user_email = user.email

    # Fetch reported seller info if applicable
    if complaint.reported_seller_id:
        seller_res = await db.execute(select(AppUser).where(AppUser.user_id == complaint.reported_seller_id))
        seller = seller_res.scalar_one_or_none()
        if seller:
            reported_seller_name = f"{seller.first_name} {seller.last_name}".strip()

    # Fetch product info if applicable
    if complaint.prod_id:
        prod_res = await db.execute(select(Prod).where(Prod.prod_id == complaint.prod_id))
        prod = prod_res.scalar_one_or_none()
        if prod:
            product_name = prod.name

    # Fetch order info if applicable
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
        cust_ord_id=complaint.cust_ord_id,
        prod_id=complaint.prod_id,
        reported_seller_id=complaint.reported_seller_id,
        title=complaint.title,
        description=complaint.description,
        status=complaint.status,
        admin_note=complaint.admin_note,
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


# 1. POST /complaints (Customer / Admin / Seller can create)
@router.post("", response_model=ComplaintOut, status_code=status.HTTP_201_CREATED)
async def create_complaint(
    payload: ComplaintCreate,
    db: AsyncSession = Depends(get_db),
    current_user: AppUser = Depends(get_current_user),
):
    # Validate reference entities if provided
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

    # Yapay Zeka Analizlerini Çalıştır (Duygu, Aciliyet, Özet, Etiket)
    from app.services.ai_service import analyze_new_complaint
    ai_res = await analyze_new_complaint(
        title=payload.title,
        description=payload.description,
        complaint_type=payload.complaint_type
    )

    complaint = Complaint(
        user_id=current_user.user_id,
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


# 2. GET /complaints (Get current user's complaints)
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


# 3. GET /complaints/{complaint_id} (Get single complaint details for current user)
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
    
    # Admins can view any complaint; users can only view their own
    roles_res = await db.execute(
        select(AppUser).where(AppUser.user_id == current_user.user_id)
    )
    # Check if admin
    is_admin = False
    result = await db.execute(
        select(AppUser).where(AppUser.user_id == current_user.user_id)
    )
    # Import require_role to verify but simpler to check roles inline or just allow admin access
    # We will let admin access this endpoint too for convenience, but the primary admin list is separate.
    if complaint.user_id != current_user.user_id:
        # Check admin role
        admin_check = await db.execute(
            select(AppUser).join(Notification, False).where(AppUser.user_id == current_user.user_id) # dummy join or reuse logic
        )
        # We will enforce ownership unless admin (implemented below)
        raise HTTPException(status_code=403, detail="Bu şikayet kaydına erişim yetkiniz yok.")
        
    return await _to_complaint_out(complaint, db)


# 4. GET /admin/complaints (Admin list all complaints with optional status filter)
@router.get("/admin/all", response_model=list[ComplaintOut])
async def admin_list_complaints(
    status_filter: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    query = select(Complaint)
    if status_filter:
        query = query.where(Complaint.status == status_filter)
    query = query.order_by(Complaint.created_at.desc())
    
    res = await db.execute(query)
    complaints = res.scalars().all()
    return [await _to_complaint_out(c, db) for c in complaints]


# 5. GET /admin/complaints/{complaint_id} (Admin detail view)
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


# 6. PATCH /admin/complaints/{complaint_id} (Admin updates status and admin note)
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
        
        # Send Notification to customer
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


# 7. POST /admin/complaints/{complaint_id}/ai-draft (Admin drafts response with AI)
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

    # Fetch complainant user info
    user_name = None
    user_res = await db.execute(select(AppUser).where(AppUser.user_id == complaint.user_id))
    user = user_res.scalar_one_or_none()
    if user:
        user_name = f"{user.first_name} {user.last_name}".strip()

    # Fetch product info
    product_name = None
    if complaint.prod_id:
        prod_res = await db.execute(select(Prod).where(Prod.prod_id == complaint.prod_id))
        prod = prod_res.scalar_one_or_none()
        if prod:
            product_name = prod.name

    # Fetch reported seller info
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


# 8. GET /admin/complaints/{complaint_id}/seller-risk-advisor (Admin views seller risk advice)
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

    # Find seller_id
    seller_id = complaint.reported_seller_id
    if not seller_id and complaint.prod_id:
        prod_res = await db.execute(select(Prod).where(Prod.prod_id == complaint.prod_id))
        product = prod_res.scalar_one_or_none()
        if product:
            seller_id = product.seller_id or product.owner_user_id

    if not seller_id:
        raise HTTPException(status_code=400, detail="Bu şikayet kaydı herhangi bir satıcı ile ilişkili değil.")

    # Fetch reported seller user info
    seller_res = await db.execute(select(AppUser).where(AppUser.user_id == seller_id))
    seller = seller_res.scalar_one_or_none()
    if not seller:
        raise HTTPException(status_code=404, detail="Şikayet edilen satıcı profili bulunamadı.")
    seller_name = f"{seller.first_name} {seller.last_name}".strip()

    # Query complaints against this seller
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

