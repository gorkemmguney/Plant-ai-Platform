from app.models.ai import AiChat, AiFeedback, AiImageAnalysis, AiMessage, AiRecommendation
from app.models.catalog import GnlChar, GnlCharVal, GnlSt, GnlTp, Prod, ProdCharVal, ProdOfr, ProdSpec
from app.models.complaint import Complaint
from app.models.customer import Ind, Org
from app.models.misc import BsnInter, BsnSpec, CntcMedium, Notification, SchJob, UserPreference
from app.models.order import CustOrd, CustOrdCharVal, CustOrdItem, CustOrdItemCharVal, SaleCnl
from app.models.bundle import Bundle, BundleItem
from app.models.campaign import Campaign, UserCoupon
from app.models.review import Review
from app.models.location import Il, Ilce, Mahalle
from app.models.address import CustomerAddress
from app.models.user import AppUser, Role, UserRole
from app.models.user_follow import UserFollow
from app.models.communication import CommAttachment, CommInteraction, CommMessage
from app.models.community import CommunityComment, CommunityLike, CommunityPost
from app.models.customer_product import CustProd, CustProdCareLog, CustProdGrowthLog

__all__ = [
    "AppUser", "Role", "UserRole", "UserFollow",
    "Org", "Ind",
    "GnlSt", "GnlTp", "Prod", "ProdSpec", "GnlChar", "GnlCharVal", "ProdCharVal", "ProdOfr",
    "SaleCnl", "CustOrd", "CustOrdItem", "CustOrdCharVal", "CustOrdItemCharVal",
    "AiChat", "AiMessage", "AiImageAnalysis", "AiRecommendation", "AiFeedback",
    "Notification", "BsnInter", "BsnSpec", "SchJob", "UserPreference", "CntcMedium",
    "Complaint", "Review", "Campaign", "UserCoupon", "Bundle", "BundleItem",
    "CommunityPost", "CommunityLike", "CommunityComment", "CustProd",
    "CustProdCareLog", "CustProdGrowthLog",
    "Il", "Ilce", "Mahalle", "CustomerAddress",
    "CommInteraction", "CommMessage", "CommAttachment",
]
