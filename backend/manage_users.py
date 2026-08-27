"""
Kullanım:
  python manage_users.py create --email seller2@plantai.com --password 123456 --role seller
  python manage_users.py create --email admin2@plantai.com --password 123456 --role admin --first-name Admin --last-name Iki
  python manage_users.py delete --email seller2@plantai.com
  python manage_users.py delete --email seller2@plantai.com --hard-delete   # kalıcı silme (dikkatli kullan)
  python manage_users.py list
"""
import argparse
import asyncio
import sys

import asyncpg
import firebase_admin
from firebase_admin import auth, credentials

from app.core.config import get_settings

settings = get_settings()


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


async def create_user(email: str, password: str, role: str, first_name: str, last_name: str):
    init_firebase()

    # 1) Firebase'de oluştur (varsa mevcut olanı kullan)
    try:
        fb_user = auth.create_user(email=email, password=password)
        print(f"✅ Firebase kullanıcısı oluşturuldu: {fb_user.uid}")
    except auth.EmailAlreadyExistsError:
        fb_user = auth.get_user_by_email(email)
        print(f"ℹ️  Firebase kullanıcısı zaten vardı: {fb_user.uid}")

    conn = await get_conn()
    try:
        # 2) role_id bul
        role_row = await conn.fetchrow("SELECT role_id FROM role WHERE role_name = $1", role)
        if role_row is None:
            print(f"❌ '{role}' adında bir rol bulunamadı. Mevcut roller:")
            rows = await conn.fetch("SELECT role_name FROM role")
            for r in rows:
                print(f"   - {r['role_name']}")
            sys.exit(1)
        role_id = role_row["role_id"]

        # 3) app_user'da var mı, yoksa oluştur
        user_row = await conn.fetchrow(
            "SELECT user_id FROM app_user WHERE supabase_uid = $1", fb_user.uid
        )
        if user_row is None:
            user_row = await conn.fetchrow(
                """
                INSERT INTO app_user (supabase_uid, email, first_name, last_name, is_active)
                VALUES ($1, $2, $3, $4, true)
                RETURNING user_id
                """,
                fb_user.uid, email, first_name, last_name,
            )

            print(f"✅ app_user kaydı oluşturuldu: user_id={user_row['user_id']}")
        else:
            print(f"ℹ️  app_user kaydı zaten vardı: user_id={user_row['user_id']}")
        user_id = user_row["user_id"]

        # 4) rolü ata (varsa dokunma)
        await conn.execute(
            """
            INSERT INTO user_role (user_id, role_id)
            VALUES ($1, $2)
            ON CONFLICT (user_id, role_id) DO NOTHING
            """,
            user_id, role_id,
        )
        print(f"✅ '{role}' rolü atandı (user_id={user_id})")

    finally:
        await conn.close()

    print("\n--- ÖZET ---")
    print(f"Email      : {email}")
    print(f"Password   : {password}")
    print(f"Firebase UID: {fb_user.uid}")
    print(f"Role       : {role}")


async def delete_user(email: str, hard_delete: bool = False):
    init_firebase()

    try:
        fb_user = auth.get_user_by_email(email)
    except auth.UserNotFoundError:
        print(f"ℹ️  Firebase'de bu email bulunamadı: {email}")
        fb_user = None

    conn = await get_conn()
    try:
        # user_id'yi bul (firebase_uid varsa onunla, yoksa email ile)
        if fb_user:
            user_row = await conn.fetchrow(
                "SELECT user_id FROM app_user WHERE supabase_uid = $1", fb_user.uid
            )
        else:
            user_row = await conn.fetchrow(
                "SELECT user_id FROM app_user WHERE email = $1", email
            )

        if user_row is None:
            print(f"ℹ️  app_user tablosunda bu kullanıcı bulunamadı: {email}")
            return

        user_id = user_row["user_id"]

        if hard_delete:
            # ESKİ DAVRANIŞ: kalıcı silme. Yalnızca siparişte/veride referansı
            # olmayan test kullanıcıları için kullan; aksi halde FK hatası alırsın.
            if fb_user:
                auth.delete_user(fb_user.uid)
                print(f"✅ Firebase kullanıcısı kalıcı silindi: {fb_user.uid}")
            result = await conn.execute(
                "DELETE FROM app_user WHERE user_id = $1", user_id
            )
            print(f"✅ app_user kaydı kalıcı silindi ({result})")
            return

        # SOFT DELETE (varsayılan davranış)
        # 1) Bu satıcıya ait ürünleri pasifleştir
        prod_result = await conn.execute(
            """
            UPDATE prod
            SET is_active = false, deleted_at = now()
            WHERE seller_id = $1 AND is_active = true
            """,
            user_id,
        )
        print(f"✅ Satıcının ürünleri pasifleştirildi ({prod_result})")

        # 2) Kullanıcıyı pasifleştir
        user_result = await conn.execute(
            "UPDATE app_user SET is_active = false, updated_at = now() WHERE user_id = $1",
            user_id,
        )
        print(f"✅ app_user pasifleştirildi ({user_result})")

        # 3) Firebase'de girişi engelle (hesabı silme, sadece devre dışı bırak)
        if fb_user:
            auth.update_user(fb_user.uid, disabled=True)
            print(f"✅ Firebase girişi devre dışı bırakıldı: {fb_user.uid}")

    finally:
        await conn.close()


async def list_users():
    conn = await get_conn()
    try:
        rows = await conn.fetch(
            """
            SELECT u.user_id, u.email, u.supabase_uid, u.is_active,
                   COALESCE(string_agg(r.role_name, ', '), '(rolsüz)') AS roles
            FROM app_user u
            LEFT JOIN user_role ur ON ur.user_id = u.user_id
            LEFT JOIN role r ON r.role_id = ur.role_id
            GROUP BY u.user_id, u.email, u.supabase_uid, u.is_active
            ORDER BY u.user_id
            """
        )

        for r in rows:
            status = "aktif" if r["is_active"] else "pasif"
            print(f"[{r['user_id']}] {r['email']:<30} roller: {r['roles']:<20} ({status})")
    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(description="Firebase + DB kullanıcı yönetimi")
    sub = parser.add_subparsers(dest="command", required=True)

    p_create = sub.add_parser("create")
    p_create.add_argument("--email", required=True)
    p_create.add_argument("--password", required=True)
    p_create.add_argument("--role", required=True, choices=["admin", "seller", "customer"])
    p_create.add_argument("--first-name", default="Test")
    p_create.add_argument("--last-name", default="Kullanıcı")

    p_delete = sub.add_parser("delete")
    p_delete.add_argument("--email", required=True)
    p_delete.add_argument(
        "--hard-delete", action="store_true",
        help="Kalıcı sil (dikkat: sipariş geçmişi olan ürünlerde FK hatası verir)"
    )

    sub.add_parser("list")

    args = parser.parse_args()

    if args.command == "create":
        asyncio.run(create_user(args.email, args.password, args.role, args.first_name, args.last_name))
    elif args.command == "delete":
        asyncio.run(delete_user(args.email, args.hard_delete))
    elif args.command == "list":
        asyncio.run(list_users())


if __name__ == "__main__":
    main()
