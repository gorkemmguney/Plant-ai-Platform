from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AddressCreateIn(BaseModel):
    title: str  # "Ev", "İş" vb.
    il_id: int
    ilce_id: int
    mahalle_id: int
    address_line: str  # sokak, bina no, daire no vb. serbest metin
    is_default: bool = False


class AddressUpdateIn(BaseModel):
    title: str | None = None
    il_id: int | None = None
    ilce_id: int | None = None
    mahalle_id: int | None = None
    address_line: str | None = None
    is_default: bool | None = None


class AddressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    address_id: int
    title: str
    il_id: int
    il_name: str
    ilce_id: int
    ilce_name: str
    mahalle_id: int
    mahalle_name: str
    address_line: str
    is_default: bool
    created_at: datetime
