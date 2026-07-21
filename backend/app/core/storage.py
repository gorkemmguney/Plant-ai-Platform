"""
Görsel yükleme modülü — Supabase Storage kullanır (Firebase Storage'ın yerini alır).

NOT: BUCKET_NAME'in Supabase Dashboard'da (Storage > New bucket) "Public bucket"
olarak işaretlenmiş şekilde önceden oluşturulmuş olması gerekir, aksi halde
dönen public URL'ler 400/403 verir.
"""
import uuid

import httpx

from app.core.config import get_settings

settings = get_settings()

BUCKET_NAME = "plant-images"


def upload_image(file_bytes: bytes, content_type: str, folder: str = "uploads") -> str:
    """
    Supabase Storage'a görsel yükler, herkese açık indirme URL'i döner.
    secret_key (service_role) kullanıldığı için bucket'ın RLS kurallarından
    bağımsız olarak yükleme yapılabilir — bu işlem SADECE backend'de çalışır.
    """
    object_path = f"{folder}/{uuid.uuid4().hex}"
    upload_url = f"{settings.SUPABASE_URL}/storage/v1/object/{BUCKET_NAME}/{object_path}"

    response = httpx.post(
        upload_url,
        headers={
            "apikey": settings.SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
            "Content-Type": content_type,
        },
        content=file_bytes,
        timeout=30.0,
    )
    response.raise_for_status()

    return f"{settings.SUPABASE_URL}/storage/v1/object/public/{BUCKET_NAME}/{object_path}"
