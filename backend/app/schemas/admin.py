from pydantic import BaseModel
from typing import Optional

class AdminStatsOut(BaseModel):
    total_users: int
    total_sellers: int
    total_analyses: int
    total_products: int

class BroadcastNotificationIn(BaseModel):
    title: str
    message: str

# AI Announcement Wizard
class AiDraftAnnouncementIn(BaseModel):
    topic: str  # Admin's short idea (e.g. "Bahar kampanyası")

class AiDraftAnnouncementOut(BaseModel):
    title: str
    message: str

# AI Platform Insights
class AiInsightsOut(BaseModel):
    report: str  # Gemini-generated markdown-like business insight text
    top_disease: Optional[str] = None
    top_product_query: Optional[str] = None

# AI Seller Profiler
class AiSellerProfileIn(BaseModel):
    user_id: int

class AiSellerProfileOut(BaseModel):
    verdict: str          # "safe" | "suspicious" | "review"
    verdict_label: str    # Türkçe label: "Güvenli", "Şüpheli", "İnceleme Önerilir"
    summary: str          # Gemini's analysis text
    risk_score: int       # 0-100

# AI Diagnosis Center
class DiseaseStatItem(BaseModel):
    disease: str
    count: int
    percentage: float

class AiDiagnosisCenterOut(BaseModel):
    disease_stats: list[DiseaseStatItem]
    ai_commentary: str
    total_analyses: int

# AI Content Moderation
class ContentModerationIn(BaseModel):
    title: str
    description: Optional[str] = None

class ContentModerationOut(BaseModel):
    verdict: str
    verdict_label: str
    reason: str
    risk_score: int

# AI Period Report
class PeriodReportOut(BaseModel):
    period_days: int
    report: str
    stats: dict

# AI Auto-Trigger Campaign
class AiTriggerCampaignOut(BaseModel):
    campaign_disease: str
    notification_title: str
    notification_template: str
    recommended_product: str
    users_notified_count: int

