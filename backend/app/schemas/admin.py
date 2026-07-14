from pydantic import BaseModel

class AdminStatsOut(BaseModel):
    total_users: int
    total_sellers: int
    total_analyses: int
    total_products: int

class BroadcastNotificationIn(BaseModel):
    title: str
    message: str
