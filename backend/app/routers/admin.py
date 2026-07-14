from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.firebase import set_role_claim
from app.core.security import get_user_roles, require_role
from app.db.session import get_db
from app.models.user import AppUser, Role, UserRole
from app.models.ai import AiImageAnalysis
from app.models.catalog import Prod
from app.models.misc import Notification
from app.rbac.roles import ROLE_HIERARCHY, RoleName
from app.schemas.user import RoleAssignIn, UserOut
from app.schemas.admin import (
    AdminStatsOut,
    BroadcastNotificationIn,
    AiDraftAnnouncementIn,
    AiDraftAnnouncementOut,
    AiInsightsOut,
    AiSellerProfileOut,
    AiDiagnosisCenterOut,
    DiseaseStatItem,
    ContentModerationIn,
    ContentModerationOut,
    PeriodReportOut,
    AiTriggerCampaignOut,
)
from app.services.ai_service import (
    draft_announcement,
    generate_platform_insights,
    profile_seller,
    generate_diagnosis_commentary,
    moderate_product_content,
    generate_period_report,
    generate_campaign_template,
)

router = APIRouter(prefix="/admin", tags=["admin"])


async def _to_user_out(user: AppUser, db: AsyncSession) -> UserOut:
    return UserOut(
        user_id=user.user_id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        is_active=user.is_active,
        created_at=user.created_at,
        roles=await get_user_roles(user, db),
        seller_status=user.seller_status,
    )


@router.get("/users", response_model=list[UserOut])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    result = await db.execute(select(AppUser).order_by(AppUser.user_id))
    users = result.scalars().all()
    return [await _to_user_out(user, db) for user in users]


@router.get("/sellers/pending", response_model=list[UserOut])
async def list_pending_sellers(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    result = await db.execute(
        select(AppUser).where(AppUser.seller_status == "pending").order_by(AppUser.user_id)
    )
    users = result.scalars().all()
    return [await _to_user_out(user, db) for user in users]


@router.post("/verify-seller/{user_id}", response_model=UserOut)
async def verify_seller(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    user_result = await db.execute(select(AppUser).where(AppUser.user_id == user_id))
    target = user_result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    role_result = await db.execute(select(Role).where(Role.role_name == RoleName.SELLER.value))
    seller_role = role_result.scalar_one_or_none()
    if seller_role is None:
        raise HTTPException(status_code=404, detail="Satıcı rolü bulunamadı (seed eksik olabilir)")

    existing_result = await db.execute(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role_id == seller_role.role_id)
    )
    if existing_result.scalar_one_or_none() is None:
        db.add(UserRole(user_id=user_id, role_id=seller_role.role_id))

    target.seller_status = "verified"
    await db.commit()
    await db.refresh(target)

    roles = await get_user_roles(target, db)
    if roles:
        top_role = max(roles, key=lambda r: ROLE_HIERARCHY.get(r, -1))
        set_role_claim(target.firebase_uid, top_role)
    return await _to_user_out(target, db)


@router.post("/reject-seller/{user_id}", response_model=UserOut)
async def reject_seller(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    user_result = await db.execute(select(AppUser).where(AppUser.user_id == user_id))
    target = user_result.scalar_one_or_none()
    if target is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    target.seller_status = "rejected"
    await db.commit()
    await db.refresh(target)
    return await _to_user_out(target, db)


@router.post("/assign-role")
async def assign_role(
    payload: RoleAssignIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    role_result = await db.execute(select(Role).where(Role.role_name == payload.role_name))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="Rol bulunamadı")

    user_result = await db.execute(select(AppUser).where(AppUser.user_id == payload.user_id))
    target_user = user_result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    existing_result = await db.execute(
        select(UserRole).where(UserRole.user_id == payload.user_id, UserRole.role_id == role.role_id)
    )
    if existing_result.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Kullanıcıda bu rol zaten var")

    db.add(UserRole(user_id=payload.user_id, role_id=role.role_id))
    await db.commit()
    set_role_claim(target_user.firebase_uid, payload.role_name)
    return {"detail": "Rol atandı"}


@router.post("/remove-role")
async def remove_role(
    payload: RoleAssignIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    role_result = await db.execute(select(Role).where(Role.role_name == payload.role_name))
    role = role_result.scalar_one_or_none()
    if role is None:
        raise HTTPException(status_code=404, detail="Rol bulunamadı")

    user_result = await db.execute(select(AppUser).where(AppUser.user_id == payload.user_id))
    target_user = user_result.scalar_one_or_none()
    if target_user is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    assignment_result = await db.execute(
        select(UserRole).where(UserRole.user_id == payload.user_id, UserRole.role_id == role.role_id)
    )
    assignment = assignment_result.scalar_one_or_none()
    if assignment is None:
        raise HTTPException(status_code=404, detail="Kullanıcıda bu rol zaten yok")

    await db.delete(assignment)
    await db.commit()

    # Firebase custom claim'i kalan rollerin en yükseğine göre yeniden hesapla
    remaining_result = await db.execute(
        select(Role.role_name)
        .join(UserRole, UserRole.role_id == Role.role_id)
        .where(UserRole.user_id == payload.user_id)
    )
    remaining_roles = [r for (r,) in remaining_result.all()]

    if remaining_roles:
        top_role = max(remaining_roles, key=lambda r: ROLE_HIERARCHY.get(r, -1))
        set_role_claim(target_user.firebase_uid, top_role)
    else:
        set_role_claim(target_user.firebase_uid, "")

    return {"detail": "Rol kaldırıldı", "remaining_roles": remaining_roles}


@router.get("/stats", response_model=AdminStatsOut)
async def get_admin_stats(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    # Total Users
    users_count = await db.scalar(select(func.count()).select_from(AppUser))

    # Total Sellers (Users who have the seller role)
    seller_role = await db.scalar(select(Role.role_id).where(Role.role_name == RoleName.SELLER.value))
    sellers_count = 0
    if seller_role:
        sellers_count = await db.scalar(
            select(func.count()).select_from(UserRole).where(UserRole.role_id == seller_role)
        )

    # Total Analyses
    analyses_count = await db.scalar(select(func.count()).select_from(AiImageAnalysis))

    # Total Products
    products_count = await db.scalar(select(func.count()).select_from(Prod))

    return AdminStatsOut(
        total_users=users_count or 0,
        total_sellers=sellers_count or 0,
        total_analyses=analyses_count or 0,
        total_products=products_count or 0,
    )


@router.post("/broadcast-notification")
async def broadcast_notification(
    payload: BroadcastNotificationIn,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    # Get all users IDs
    users_result = await db.execute(select(AppUser.user_id))
    user_ids = [uid for (uid,) in users_result.all()]
    
    if not user_ids:
        raise HTTPException(status_code=404, detail="Sistemde hiç kullanıcı bulunamadı")

    # Insert notification for every user
    for uid in user_ids:
        db.add(
            Notification(
                user_id=uid,
                title=payload.title,
                message=payload.message,
                is_read=False,
            )
        )
    await db.commit()
    return {"detail": f"{len(user_ids)} kullanıcıya duyuru başarıyla gönderildi."}


# ─── AI Admin Feature 1: Announcement Draft Wizard ──────────────────────────

@router.post("/ai/draft-announcement", response_model=AiDraftAnnouncementOut)
async def ai_draft_announcement(
    payload: AiDraftAnnouncementIn,
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    """Gemini writes a professional Turkish push notification from a short topic idea."""
    if not payload.topic.strip():
        raise HTTPException(status_code=400, detail="Konu boş olamaz.")
    result = await draft_announcement(payload.topic)
    return AiDraftAnnouncementOut(title=result["title"], message=result["message"])


# ─── AI Admin Feature 2: Platform Business Insights ─────────────────────────

@router.get("/ai/insights", response_model=AiInsightsOut)
async def ai_platform_insights(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    """Gemini generates business advice based on live platform stats."""
    from datetime import datetime, timedelta, timezone

    total_users = await db.scalar(select(func.count()).select_from(AppUser)) or 0
    seller_role_id = await db.scalar(select(Role.role_id).where(Role.role_name == RoleName.SELLER.value))
    total_sellers = 0
    if seller_role_id:
        total_sellers = await db.scalar(
            select(func.count()).select_from(UserRole).where(UserRole.role_id == seller_role_id)
        ) or 0
    total_analyses = await db.scalar(select(func.count()).select_from(AiImageAnalysis)) or 0
    total_products = await db.scalar(select(func.count()).select_from(Prod)) or 0

    # Recent analyses (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_analyses = await db.scalar(
        select(func.count()).select_from(AiImageAnalysis).where(AiImageAnalysis.created_at >= week_ago)
    ) or 0

    stats = {
        "total_users": total_users,
        "total_sellers": total_sellers,
        "total_analyses": total_analyses,
        "total_products": total_products,
        "recent_analyses": recent_analyses,
        "top_issue": "Külleme Hastalığı",
    }

    report = await generate_platform_insights(stats)
    return AiInsightsOut(report=report)


# ─── AI Admin Feature 3: Seller Risk Profiler ───────────────────────────────

@router.get("/ai/seller-profile/{user_id}", response_model=AiSellerProfileOut)
async def ai_seller_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    """Gemini analyses a pending seller's registration data and returns a risk verdict."""
    result = await db.execute(select(AppUser).where(AppUser.user_id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    profile = await profile_seller(
        email=user.email or "",
        first_name=user.first_name or "",
        last_name=user.last_name or "",
    )
    return AiSellerProfileOut(**profile)


# ─── AI Admin Feature 4: Diagnosis Center ────────────────────────────────────

@router.get("/ai/diagnosis-center", response_model=AiDiagnosisCenterOut)
async def ai_diagnosis_center(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    """Returns platform-wide disease statistics + Gemini commentary."""
    import json as _json

    # Fetch all analysis results
    results = await db.execute(select(AiImageAnalysis.result))
    raw_results = [r for (r,) in results.all() if r]

    # Count disease occurrences
    disease_counts: dict[str, int] = {}
    total = len(raw_results)

    for raw in raw_results:
        try:
            data = _json.loads(raw)
            issues = data.get("issues_detected", [])
            health = data.get("health_status", "unknown")
            if issues:
                for issue in issues:
                    if issue:
                        disease_counts[issue] = disease_counts.get(issue, 0) + 1
            else:
                disease_counts[health] = disease_counts.get(health, 0) + 1
        except Exception:
            disease_counts["unknown"] = disease_counts.get("unknown", 0) + 1

    if not disease_counts:
        disease_counts = {"Veri yok": total or 1}
        total = total or 1

    sorted_diseases = sorted(disease_counts.items(), key=lambda x: x[1], reverse=True)
    disease_stats = [
        DiseaseStatItem(disease=d, count=c, percentage=round(c / total * 100, 1))
        for d, c in sorted_diseases[:10]
    ]

    commentary = await generate_diagnosis_commentary(
        [s.model_dump() for s in disease_stats], total
    )
    return AiDiagnosisCenterOut(
        disease_stats=disease_stats,
        ai_commentary=commentary,
        total_analyses=total,
    )


# ─── AI Admin Feature 5: Content Moderation ──────────────────────────────────

@router.post("/ai/content-moderation", response_model=ContentModerationOut)
async def ai_content_moderation(
    payload: ContentModerationIn,
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    """Gemini reviews a product listing for policy violations."""
    result = await moderate_product_content(
        title=payload.title,
        description=payload.description or "",
    )
    return ContentModerationOut(**result)


# ─── AI Admin Feature 6: Period Report ───────────────────────────────────────

@router.get("/ai/period-report", response_model=PeriodReportOut)
async def ai_period_report(
    period: int = Query(default=7, ge=1, le=90),
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    """Gemini generates a comprehensive period report based on live stats."""
    from datetime import datetime, timedelta, timezone

    since = datetime.now(timezone.utc) - timedelta(days=period)

    total_users = await db.scalar(select(func.count()).select_from(AppUser)) or 0
    new_users = await db.scalar(
        select(func.count()).select_from(AppUser).where(AppUser.created_at >= since)
    ) or 0
    total_analyses = await db.scalar(select(func.count()).select_from(AiImageAnalysis)) or 0
    recent_analyses = await db.scalar(
        select(func.count()).select_from(AiImageAnalysis).where(AiImageAnalysis.created_at >= since)
    ) or 0
    total_products = await db.scalar(select(func.count()).select_from(Prod)) or 0

    seller_role_id = await db.scalar(select(Role.role_id).where(Role.role_name == RoleName.SELLER.value))
    new_sellers = 0
    if seller_role_id:
        new_sellers = await db.scalar(
            select(func.count()).select_from(UserRole).where(UserRole.role_id == seller_role_id)
        ) or 0

    stats = {
        "new_users": new_users,
        "total_users": total_users,
        "total_analyses": total_analyses,
        "recent_analyses": recent_analyses,
        "new_sellers": new_sellers,
        "total_products": total_products,
    }

    report = await generate_period_report(period, stats)
    return PeriodReportOut(period_days=period, report=report, stats=stats)


# ─── AI Admin Feature 7: Auto-Trigger Campaign ──────────────────────────────

@router.post("/ai/trigger-campaign", response_model=AiTriggerCampaignOut)
async def ai_trigger_campaign(
    db: AsyncSession = Depends(get_db),
    _: AppUser = Depends(require_role(RoleName.ADMIN)),
):
    """Finds top disease and inserts personalized push notifications for all users."""
    import json as _json

    # 1. Fetch analysis results to find top disease
    results = await db.execute(select(AiImageAnalysis.result))
    raw_results = [r for (r,) in results.all() if r]

    disease_counts: dict[str, int] = {}
    for raw in raw_results:
        try:
            data = _json.loads(raw)
            issues = data.get("issues_detected", [])
            health = data.get("health_status", "unknown")
            if issues:
                for issue in issues:
                    if issue:
                        disease_counts[issue] = disease_counts.get(issue, 0) + 1
            else:
                disease_counts[health] = disease_counts.get(health, 0) + 1
        except Exception:
            pass

    # Find top disease (excluding healthy/unknown if possible, fallback to healthy/unknown)
    non_healthy = {k: v for k, v in disease_counts.items() if k not in ["healthy", "unknown"]}
    if non_healthy:
        top_disease = max(non_healthy, key=non_healthy.get)
    elif disease_counts:
        top_disease = max(disease_counts, key=disease_counts.get)
    else:
        top_disease = "Külleme Hastalığı" # Fallback

    # Mapping disease key to pretty Turkish label
    pretty_diseases = {
        "healthy": "Sağlıklı",
        "diseased": "Bitki Hastalığı",
        "pest_damage": "Bitki Zararlısı",
        "unknown": "Yaprak Lekesi",
    }
    top_disease_pretty = pretty_diseases.get(top_disease, top_disease)

    # 2. Call Gemini to create campaign template
    campaign = await generate_campaign_template(top_disease_pretty)

    # 3. Fetch all active users
    users_result = await db.execute(select(AppUser).where(AppUser.is_active == True))
    users = users_result.scalars().all()

    # 4. Insert notifications with personalized names
    title = campaign["notification_title"]
    template = campaign["notification_template"]
    
    for user in users:
        # Interpolate template
        first_name = user.first_name or "Müşterimiz"
        message = template.replace("{first_name}", first_name)
        
        db.add(
            Notification(
                user_id=user.user_id,
                title=title,
                message=message,
                is_read=False,
            )
        )
    
    await db.commit()

    return AiTriggerCampaignOut(
        campaign_disease=top_disease_pretty,
        notification_title=title,
        notification_template=template,
        recommended_product=campaign["recommended_product"],
        users_notified_count=len(users),
    )

