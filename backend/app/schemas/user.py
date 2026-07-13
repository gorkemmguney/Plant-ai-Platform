from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user_id: int
    email: str
    first_name: str
    last_name: str
    is_active: bool
    created_at: datetime
    roles: list[str] = []
    is_seller_verified: bool | None = None


class RoleAssignIn(BaseModel):
    user_id: int
    role_name: str  # 'admin' | 'seller' | 'customer'


class RegisterIn(BaseModel):
    role_name: Literal["customer", "seller"]
