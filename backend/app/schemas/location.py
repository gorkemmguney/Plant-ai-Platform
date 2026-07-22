from pydantic import BaseModel, ConfigDict


class IlOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    il_id: int
    name: str


class IlceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    ilce_id: int
    il_id: int
    name: str


class MahalleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    mahalle_id: int
    ilce_id: int
    name: str
