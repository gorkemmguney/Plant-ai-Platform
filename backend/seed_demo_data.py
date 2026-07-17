"""
Demo/test verisi oluşturur: 5 satıcı + her birine birkaç ürün.
Kullanım:
  python seed_demo_data.py
"""
import asyncio

import asyncpg
import firebase_admin
from firebase_admin import auth, credentials

from app.core.config import get_settings

settings = get_settings()

IN_STOCK_ID = 3  # gnl_st.code = 'IN_STOCK'

SELLERS = [
    {
        "email": "yesilbahce@plantai.com",
        "password": "demo12345",
        "first_name": "Ayşe",
        "last_name": "Yılmaz",
        "store_name": "Yeşil Bahçe",
        "products": [
            {"name": "Monstera Deliciosa", "description": "Büyük yapraklı iç mekan bitkisi", "price": 450.00, "stock": 12, "prod_spec_id": 1},
            {"name": "Zamioculcas", "description": "Az bakım isteyen dayanıklı süs bitkisi", "price": 320.00, "stock": 20, "prod_spec_id": 1},
            {"name": "Areka Palmiyesi", "description": "İç mekan için palmiye türü", "price": 590.00, "stock": 8, "prod_spec_id": 5},
        ],
    },
    {
        "email": "cicekevi@plantai.com",
        "password": "demo12345",
        "first_name": "Mehmet",
        "last_name": "Demir",
        "store_name": "Çiçek Evi",
        "products": [
            {"name": "Orkide", "description": "Beyaz çiçekli orkide", "price": 275.00, "stock": 15, "prod_spec_id": 2},
            {"name": "Gerbera", "description": "Renkli kesme çiçek", "price": 90.00, "stock": 40, "prod_spec_id": 2},
            {"name": "Lavanta", "description": "Mor çiçekli, mis kokulu", "price": 110.00, "stock": 25, "prod_spec_id": 6},
        ],
    },
    {
        "email": "kaktusdunyasi@plantai.com",
        "password": "demo12345",
        "first_name": "Elif",
        "last_name": "Kaya",
        "store_name": "Kaktüs Dünyası",
        "products": [
            {"name": "Mini Kaktüs Seti (3'lü)", "description": "Küçük saksılarda 3 farklı kaktüs", "price": 150.00, "stock": 30, "prod_spec_id": 3},
            {"name": "Echinocactus", "description": "Yuvarlak, dikenli kaktüs", "price": 210.00, "stock": 18, "prod_spec_id": 3},
        ],
    },
    {
        "email": "sukulentbahce@plantai.com",
        "password": "demo12345",
        "first_name": "Can",
        "last_name": "Öztürk",
        "store_name": "Sukulent Bahçesi",
        "products": [
            {"name": "Echeveria", "description": "Pastel renkli sukulent", "price": 85.00, "stock": 35, "prod_spec_id": 4},
            {"name": "Haworthia", "description": "Küçük boy, kolay bakım sukulent", "price": 70.00, "stock": 40, "prod_spec_id": 4},
            {"name": "Sukulent Karışık Saksı", "description": "5 farklı sukulent bir arada", "price": 195.00, "stock": 14, "prod_spec_id": 4},
        ],
    },
    {
        "email": "bahcemarket@plantai.com",
        "password": "demo12345",
        "first_name": "Zeynep",
        "last_name": "Arslan",
        "store_name": "Bahçe Market",
        "products": [
            {"name": "Lavanta Fidanı (Dış Mekan)", "description": "Bahçe için lavanta fidanı", "price": 60.00, "stock": 50, "prod_spec_id": 6},
            {"name": "Gül Fidanı", "description": "Kırmızı çiçekli gül fidanı", "price": 130.00, "stock": 22, "prod_spec_id": 6},
            {"name": "Ficus Benjamina", "description": "İç mekan için ağaç formunda ficus", "price": 380.00, "stock": 10, "prod_spec_id": 5},
        ],
    },
]


def init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        firebase_admin.initialize_app(cred)


async def get_conn():
    return await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USERNAME,
        password=settings.DB_PASSWORD,
    )


async def seed():
    init_firebase()
    conn = await get_conn()
    try:
        role_row = await conn.fetchrow("SELECT role_id FROM role WHERE role_name = 'seller'")
        if role_row is None:
            print("❌ 'seller' rolü bulunamadı, önce rolleri kontrol et.")
            return
        seller_role_id = role_row["role_id"]

        for seller in SELLERS:
            email = seller["email"]

            # 1) Firebase
            try:
                fb_user = auth.create_user(email=email, password=seller["password"])
                print(f"✅ Firebase kullanıcısı oluşturuldu: {email}")
            except auth.EmailAlreadyExistsError:
                fb_user = auth.get_user_by_email(email)
                print(f"ℹ️  Firebase kullanıcısı zaten vardı: {email}")

            # 2) app_user
            user_row = await conn.fetchrow(
                "SELECT user_id FROM app_user WHERE firebase_uid = $1", fb_user.uid
            )
            if user_row is None:
                user_row = await conn.fetchrow(
                    """
                    INSERT INTO app_user (firebase_uid, email, first_name, last_name, is_active, store_name, seller_status)
                    VALUES ($1, $2, $3, $4, true, $5, 'verified')
                    RETURNING user_id
                    """,
                    fb_user.uid, email, seller["first_name"], seller["last_name"], seller["store_name"],
                )
                print(f"✅ app_user oluşturuldu: {seller['store_name']} (user_id={user_row['user_id']})")
            else:
                await conn.execute(
                    "UPDATE app_user SET is_active = true, store_name = $2, seller_status = 'verified' WHERE user_id = $1",
                    user_row["user_id"], seller["store_name"],
                )
                print(f"ℹ️  app_user zaten vardı, güncellendi: {seller['store_name']} (user_id={user_row['user_id']})")
            user_id = user_row["user_id"]

            # 3) seller rolü
            await conn.execute(
                """
                INSERT INTO user_role (user_id, role_id)
                VALUES ($1, $2)
                ON CONFLICT (user_id, role_id) DO NOTHING
                """,
                user_id, seller_role_id,
            )

            # 4) ürünler
            for p in seller["products"]:
                existing = await conn.fetchrow(
                    "SELECT prod_id FROM prod WHERE seller_id = $1 AND name = $2",
                    user_id, p["name"],
                )
                if existing:
                    print(f"   ℹ️  Ürün zaten vardı: {p['name']}")
                    continue
                await conn.execute(
                    """
                    INSERT INTO prod (name, description, price, stock, gnl_st_id, prod_spec_id, seller_id, is_active)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, true)
                    """,
                    p["name"], p["description"], p["price"], p["stock"], IN_STOCK_ID, p["prod_spec_id"], user_id,
                )
                print(f"   ✅ Ürün eklendi: {p['name']} ({p['price']} TL, stok={p['stock']})")

        print("\n🎉 Demo verisi hazır: 5 mağaza ve ürünleri eklendi.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(seed())
