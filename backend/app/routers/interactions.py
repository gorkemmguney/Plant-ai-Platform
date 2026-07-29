from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_user_roles, require_role, resolve_role_id
from app.db.session import get_db
from app.models.misc import BsnInter, BsnSpec
from app.models.user import AppUser, Role
from app.rbac.roles import RoleName
from app.schemas.interaction import InteractionCreateIn, InteractionOut

router = APIRouter(prefix="/interactions", tags=["interactions"])


@router.post("", response_model=InteractionOut, status_code=201)
async def log_interaction(
    payload: InteractionCreateIn,
    db: AsyncSession = Depends(get_db),
    # Artık satıcı da kendi etkileşimini loglayabiliyor (ör. PROD_CANCEL) — cust profiline gerek yok,
    # her app_user zaten kendi kimliğiyle (app_user_id) loglar.
    user: AppUser = Depends(require_role(RoleName.CUSTOMER, RoleName.SELLER, RoleName.ADMIN)),
):
    spec_result = await db.execute(
        select(BsnSpec).where(BsnSpec.srt_code == payload.srt_code, BsnSpec.is_active.is_(True))
    )
    spec = spec_result.scalar_one_or_none()
    if spec is None:
        raise HTTPException(status_code=400, detail=f"Geçersiz veya pasif etkileşim türü: {payload.srt_code}")

    if payload.actor_role is not None:
        # Kullanıcı hangi şapkayla işlem yaptığını açıkça belirtti — gerçekten o role
        # sahip mi diye doğruluyoruz (biri sahip olmadığı bir rolü iddia edip logu
        # kirletemesin diye).
        user_roles = await get_user_roles(user, db)
        if payload.actor_role not in user_roles:
            raise HTTPException(
                status_code=403, detail=f"Bu kullanıcı '{payload.actor_role}' rolüne sahip değil"
            )
        role_result = await db.execute(select(Role.role_id).where(Role.role_name == payload.actor_role))
        actor_role_id = role_result.scalar_one_or_none()
        if actor_role_id is None:
            raise HTTPException(status_code=400, detail=f"Geçersiz rol: {payload.actor_role}")
    else:
        # Belirtilmediyse varsayılan öncelik sırasına göre çöz (bu endpoint'e kimin
        # girebildiğiyle aynı sıra: CUSTOMER, SELLER, ADMIN).
        actor_role_id = await resolve_role_id(
            user, db, [RoleName.CUSTOMER, RoleName.SELLER, RoleName.ADMIN]
        )

    inter = BsnInter(
        bsn_spec_id=spec.bsn_spec_id,
        app_user_id=user.user_id,
        actor_role_id=actor_role_id,
        sale_cnl_id=payload.sale_cnl_id,
    )
    db.add(inter)
    await db.commit()
    await db.refresh(inter)
    return inter
