"""
Türkiye il/ilçe/mahalle verisini il_ilce_mahalle.json dosyasından okuyup
veritabanına toplu (bulk) olarak yükler.

Kullanım:
  1) il_ilce_mahalle.json dosyasını bu script ile AYNI klasöre (backend/) koyun.
  2) create_address_tables.sql'i önce Supabase SQL Editor'da çalıştırmış olun
     (tablolar zaten var olmalı).
  3) python seed_locations.py
"""
import asyncio
import json
from pathlib import Path

import asyncpg

from app.core.config import get_settings

settings = get_settings()

JSON_PATH = Path(__file__).parent / "il_ilce_mahalle.json"


async def get_conn():
    return await asyncpg.connect(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USERNAME,
        password=settings.DB_PASSWORD,
        ssl="require" if "supabase.co" in settings.DB_HOST else None,
    )


async def main():
    if not JSON_PATH.exists():
        print(f"❌ {JSON_PATH} bulunamadı. Dosyayı backend/ klasörüne koyun.")
        return

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    conn = await get_conn()

    try:
        existing = await conn.fetchval("SELECT COUNT(*) FROM il")
        if existing and existing > 0:
            print(f"ℹ️  'il' tablosunda zaten {existing} kayıt var — tekrar yüklemek için")
            print("   önce 'TRUNCATE il CASCADE;' ile temizleyin, sonra bu script'i tekrar çalıştırın.")
            return

        il_id_map: dict[str, int] = {}
        ilce_id_map: dict[tuple[str, str], int] = {}

        print("İller ekleniyor...")
        for il_name in data.keys():
            il_id = await conn.fetchval(
                "INSERT INTO il (name) VALUES ($1) RETURNING il_id", il_name
            )
            il_id_map[il_name] = il_id
        print(f"✅ {len(il_id_map)} il eklendi")

        print("İlçeler ekleniyor...")
        ilce_count = 0
        for il_name, ilceler in data.items():
            il_id = il_id_map[il_name]
            for ilce_name in ilceler.keys():
                ilce_id = await conn.fetchval(
                    "INSERT INTO ilce (il_id, name) VALUES ($1, $2) RETURNING ilce_id", il_id, ilce_name
                )
                ilce_id_map[(il_name, ilce_name)] = ilce_id
                ilce_count += 1
        print(f"✅ {ilce_count} ilçe eklendi")

        print("Mahalleler ekleniyor (bu biraz sürebilir)...")
        mahalle_rows: list[tuple[int, str]] = []
        for il_name, ilceler in data.items():
            for ilce_name, mahalleler in ilceler.items():
                ilce_id = ilce_id_map[(il_name, ilce_name)]
                for mahalle_name in mahalleler:
                    mahalle_rows.append((ilce_id, mahalle_name))

        # Toplu ekleme (executemany yerine copy_records_to_table — çok daha hızlı)
        await conn.copy_records_to_table(
            "mahalle", records=mahalle_rows, columns=["ilce_id", "name"]
        )
        print(f"✅ {len(mahalle_rows)} mahalle eklendi")

        print("\n🎉 Tamamlandı — il/ilce/mahalle verisi veritabanında hazır.")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
