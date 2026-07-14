import os
import logging
from functools import lru_cache
from jose import jwt

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.core.config import get_settings

logger = logging.getLogger("alembic" if __name__ == "alembic" else "uvicorn")

# Credentials dosyası var mı kontrol et
settings = get_settings()
FIREBASE_ENABLED = os.path.exists(settings.FIREBASE_CREDENTIALS_PATH)

if not FIREBASE_ENABLED:
    logger.warning("⚠️ WARNING: Firebase credentials file not found at '%s'. Backend is running in MOCK/DEVELOPMENT auth mode (Token signature will NOT be verified).", settings.FIREBASE_CREDENTIALS_PATH)

@lru_cache
def get_firebase_app() -> firebase_admin.App | None:
    if not FIREBASE_ENABLED:
        return None
    try:
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
        return firebase_admin.initialize_app(
            cred,
            {
                "projectId": settings.FIREBASE_PROJECT_ID,
                "storageBucket": f"{settings.FIREBASE_PROJECT_ID}.firebasestorage.app",
            },
        )
    except Exception as e:
        logger.error("Failed to initialize Firebase Admin SDK, falling back to mock: %s", e)
        return None


class InvalidTokenError(Exception):
    pass


def verify_id_token(id_token: str) -> dict:
    if not FIREBASE_ENABLED:
        try:
            # Geliştirme modunda imzayı doğrulamadan çözüyoruz
            decoded = jwt.get_unverified_claims(id_token)
            # Firebase Admin SDK'nın döndürdüğü "uid" alanını sub/user_id'den eşliyoruz
            decoded["uid"] = decoded.get("user_id") or decoded.get("sub")
            if not decoded["uid"]:
                raise InvalidTokenError("Token lacks 'uid' or 'sub' claim")
            return decoded
        except Exception as exc:
            raise InvalidTokenError(str(exc)) from exc

    app = get_firebase_app()
    if app is None:
        # Firebase etkinleştirilemediyse mock davranışına dön
        try:
            decoded = jwt.get_unverified_claims(id_token)
            decoded["uid"] = decoded.get("user_id") or decoded.get("sub")
            return decoded
        except Exception as exc:
            raise InvalidTokenError(str(exc)) from exc

    try:
        decoded = firebase_auth.verify_id_token(id_token, check_revoked=True)
        return decoded
    except Exception as exc:
        raise InvalidTokenError(str(exc)) from exc


def set_role_claim(uid: str, role_name: str) -> None:
    app = get_firebase_app()
    if app is not None:
        firebase_auth.set_custom_user_claims(uid, {"role": role_name})
    else:
        logger.info("[MOCK AUTH] set_role_claim: uid=%s, role=%s", uid, role_name)

