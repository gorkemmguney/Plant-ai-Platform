"""
5 gerçek (Supabase Auth destekli) örnek satıcı hesabı oluşturur.
Bu script, önceki Firebase döneminden kalma "hayalet" satıcıların yerine geçecek
GERÇEK, giriş yapılabilir hesaplar açar (seller_status='verified', rol='seller').

ÖNEMLİ: Bu script'i çalıştırmadan ÖNCE step1_backup_and_delete_ghosts.sql'i
Supabase SQL Editor'da çalıştırıp eski hayalet kullanıcıları silmiş olmanız gerekir
(aksi halde aynı email'ler için "duplicate key" hatası alırsınız).

Tekrar çalıştırılabilir (idempotent): bir hesap zaten Supabase Auth'ta varsa
yeniden oluşturmaya çalışmaz, mevcut olanı bulup kullanır.

Kullanım:
  python seed_real_sellers.py
"""
import asyncio

import asyncpg

from app.core.config import get_settings
from app.core.supabase_auth import create_user, get_user_by_email

settings = get_settings()

DEFAULT_PASSWORD = "123456"

SELLERS = [
    {
        "email": "yesilbahce@plantai.com",
        "first_name": "Yeşil",
        "last_name": "Bahçe",
        "store_name": "Yeşil Bahçe",
    },
    {
        "email": "cicekevi@plantai.com",
        "first_name": "Çiçek",
        "last_name": "Evi",
        "store_name": "Çiçek Evi",
    },
    {
        "email": "kaktusdunyasi@plantai.com",
        "first_name": "Kaktüs",
        "last_name": "Dünyası",
        "store_name": "Kaktüs Dünyası",
    },
    {
        "email": "sukulentbahce@plantai.com",
        "first_name": "Sukulent",
        "last_name": "Bahçe",
        "store_name": "Sukulent Bahçe",
    },
    {
        "email": "bahcemarket@plantai.com",
        "first_name": "Bahçe",
        "last_name": "Market",
        "store_name": "Bahçe Market",
    },
]


async def get_conn():
    return await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USERNAME,
        password=settings.DB_PASSWORD,
        ssl="require" if "supabase.co" in settings.DB_HOST else None,
    )


def get_or_create_auth_uid(email: str, password: str) -> str:
    """Önce Supabase Auth'ta bu email'in olup olmadığına bakar (idempotent).
    Varsa mevcut UUID'yi döner, yoksa yeni kullanıcı oluşturur."""
    existing = get_user_by_email(email)
    if existing:
        print(f"ℹ️  Supabase Auth'ta zaten vardı: {email} -> {existing['id']}")
        return existing["id"]
    created = create_user(email, password, email_confirm=True)
    print(f"✅ Supabase Auth kullanıcısı oluşturuldu: {email} -> {created['id']}")
    return created["id"]


async def main():
    conn = await get_conn()
    try:
        seller_role_row = await conn.fetchrow("SELECT role_id FROM role WHERE role_name = 'seller'")
        if seller_role_row is None:
            print("❌ HATA: 'seller' rolü role tablosunda bulunamadı.")
            return
        seller_role_id = seller_role_row["role_id"]

        for s in SELLERS:
            uid = get_or_create_auth_uid(s["email"], DEFAULT_PASSWORD)

            existing = await conn.fetchrow("SELECT user_id FROM app_user WHERE supabase_uid = $1", uid)
            if existing:
                user_id = existing["user_id"]
                print(f"ℹ️  app_user zaten vardı: user_id={user_id}")
            else:
                row = await conn.fetchrow(
                    """
                    INSERT INTO app_user (supabase_uid, email, first_name, last_name, is_active, seller_status, store_name)
                    VALUES ($1, $2, $3, $4, true, 'verified', $5)
                    RETURNING user_id
                    """,
                    uid, s["email"], s["first_name"], s["last_name"], s["store_name"],
                )

                user_id = row["user_id"]
                print(f"✅ app_user oluşturuldu: user_id={user_id}")

            existing_role = await conn.fetchrow(
                "SELECT user_role_id FROM user_role WHERE user_id = $1 AND role_id = $2",
                user_id, seller_role_id,
            )
            if existing_role is None:
                await conn.execute(
                    "INSERT INTO user_role (user_id, role_id) VALUES ($1, $2)",
                    user_id, seller_role_id,
                )
                print(f"✅ 'seller' rolü atandı (user_id={user_id})\n")
            else:
                print(f"ℹ️  'seller' rolü zaten atanmıştı (user_id={user_id})\n")

        print("\n--- ÖZET: Bu bilgilerle mobil uygulamada giriş yapabilirsiniz ---")
        for s in SELLERS:
            print(f"{s['store_name']:<18} | {s['email']:<28} | {DEFAULT_PASSWORD}")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
