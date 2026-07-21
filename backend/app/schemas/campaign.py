from pydantic import BaseModel, ConfigDict


class CampaignOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    campaign_id: int
    title: str
    description: str | None = None
    required_points: int
    reward_text: str | None = None
    seller_id: int | None = None
    seller_name: str | None = None


class RedeemOut(BaseModel):
    detail: str
    coupon_code: str
    remaining_points: int


class CouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    coupon_id: int
    code: str
    discount_amount: float
    seller_id: int | None = None
    seller_name: str | None = None
