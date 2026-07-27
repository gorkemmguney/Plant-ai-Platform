from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.routers import seller_reports, admin, ai, auth, bundles, campaigns, catalog, complaints, coupons, customers, interactions, notifications, orders, reviews, locations, addresses, community, customer_products
settings = get_settings()

app = FastAPI(
    title=settings.APP_NAME,
    description="Bitki alım-satım platformu için REST API. Kimlik doğrulama Firebase Authentication "
    "üzerinden yapılır (email/şifre ve Microsoft OIDC dahil); rol yönetimi (admin/seller/customer) "
    "bu servisteki PostgreSQL veritabanında tutulur.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(catalog.router)
app.include_router(orders.router)
app.include_router(customers.router)
app.include_router(ai.router)
app.include_router(notifications.router)
app.include_router(complaints.router)
app.include_router(reviews.router)
app.include_router(campaigns.router)
app.include_router(coupons.router)
app.include_router(bundles.router)
app.include_router(seller_reports.router)
app.include_router(locations.router)
app.include_router(addresses.router)
app.include_router(community.router)
app.include_router(customer_products.router)
app.include_router(interactions.router)


@app.get("/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME}
