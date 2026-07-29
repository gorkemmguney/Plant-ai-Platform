from datetime import datetime

from pydantic import BaseModel, ConfigDict


class InteractionCreateIn(BaseModel):
    srt_code: str
    sale_cnl_id: int | None = None
    actor_role: str | None = None  # 'customer' | 'seller' | 'admin' — kullanıcı hangi şapkayla işlem yaptı


class InteractionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    bsn_inter_id: int
    bsn_spec_id: int
    app_user_id: int
    actor_role_id: int
    sale_cnl_id: int | None = None
    cdate: datetime
