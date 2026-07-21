"""
Supabase Authentication doğrulama modülü.

Firebase Admin SDK'nın yerini alır. Supabase, kullanıcı oturum token'larını
(access_token) varsayılan olarak asimetrik bir anahtarla (ES256 / ECC P-256)
imzalar ve public anahtarları şu adreste JWKS formatında yayınlar:

    {SUPABASE_URL}/auth/v1/.well-known/jwks.json

Bu modül:
- JWKS'i çekip önbelleğe alan bir istemci tutar (anahtar rotasyonlarında
  otomatik olarak günceller, PyJWT'nin PyJWKClient'ı bunu üstlenir).
- verify_id_token(token): RN'den gelen Supabase access_token'ını doğrular,
  Firebase'deki verify_id_token ile aynı sözleşmeyi korur — geriye dönen
  dict içinde "uid" anahtarı (Supabase'de bu, kullanıcının UUID'si olan
  "sub" claim'idir) bulunur, böylece security.py hiç değişmeden çalışır.
- set_role_claim(uid, role): Supabase Admin API üzerinden kullanıcının
  app_metadata'sına rol bilgisini yazar (bir sonraki token yenilemesinde
  JWT içine "role" claim'i olarak yansır).
"""
from functools import lru_cache

import httpx
import jwt
from jwt import PyJWKClient

from app.core.config import get_settings

settings = get_settings()


class InvalidTokenError(Exception):
    pass


@lru_cache
def _jwks_client() -> PyJWKClient:
    jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True)


def verify_id_token(id_token: str) -> dict:
    """
    RN uygulamasından gelen Supabase access_token'ını doğrular.
    Dönen dict: sub (UUID), email, uid (sub ile aynı — geriye dönük uyumluluk),
    app_metadata (role gibi custom claim'ler burada), user_metadata.
    """
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(id_token)
        decoded = jwt.decode(
            id_token,
            signing_key.key,
            algorithms=["ES256", "RS256"],
            audience="authenticated",
            options={"verify_exp": True},
        )
    except Exception as exc:
        raise InvalidTokenError(str(exc)) from exc

    decoded["uid"] = decoded.get("sub")
    if not decoded["uid"]:
        raise InvalidTokenError("Token 'sub' claim'i içermiyor")
    return decoded


def _admin_headers() -> dict:
    return {
        "apikey": settings.SUPABASE_SECRET_KEY,
        "Authorization": f"Bearer {settings.SUPABASE_SECRET_KEY}",
        "Content-Type": "application/json",
    }


def set_role_claim(uid: str, role_name: str) -> None:
    """
    Supabase Admin API ile kullanıcının app_metadata'sına rol bilgisini yazar.
    Bu bilgi, kullanıcının BİR SONRAKİ token yenilemesinde JWT'ye yansır —
    anlık değildir (Firebase'deki set_custom_user_claims ile aynı davranış).
    """
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{uid}"
    try:
        response = httpx.put(
            url,
            headers=_admin_headers(),
            json={"app_metadata": {"role": role_name}},
            timeout=10.0,
        )
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise InvalidTokenError(f"Supabase Admin API hatası: {exc}") from exc


def create_user(email: str, password: str, email_confirm: bool = True) -> dict:
    """
    Supabase Admin API ile kullanıcı oluşturur (manage_users.py / seed script'leri için).
    Döner: {"id": "<uuid>", "email": "...", ...}
    """
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    response = httpx.post(
        url,
        headers=_admin_headers(),
        json={"email": email, "password": password, "email_confirm": email_confirm},
        timeout=10.0,
    )
    response.raise_for_status()
    return response.json()


def delete_user(uid: str) -> None:
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users/{uid}"
    response = httpx.delete(url, headers=_admin_headers(), timeout=10.0)
    response.raise_for_status()


def get_user_by_email(email: str) -> dict | None:
    """Supabase Admin API'de doğrudan email ile arama yoktur; listeleyip filtreleriz."""
    url = f"{settings.SUPABASE_URL}/auth/v1/admin/users"
    response = httpx.get(url, headers=_admin_headers(), params={"page": 1, "per_page": 1000}, timeout=10.0)
    response.raise_for_status()
    users = response.json().get("users", [])
    for u in users:
        if u.get("email") == email:
            return u
    return None
