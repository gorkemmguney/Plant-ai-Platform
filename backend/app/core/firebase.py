
from functools import lru_cache

import firebase_admin
from firebase_admin import auth as firebase_auth
from firebase_admin import credentials

from app.core.config import get_settings


@lru_cache
def get_firebase_app() -> firebase_admin.App:
    settings = get_settings()
    cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS_PATH)
    return firebase_admin.initialize_app(cred, {"projectId": settings.FIREBASE_PROJECT_ID})


class InvalidTokenError(Exception):
    pass


def verify_id_token(id_token: str) -> dict:
    
    get_firebase_app()
    try:
        decoded = firebase_auth.verify_id_token(id_token, check_revoked=True)
        return decoded
    except Exception as exc:  # firebase_admin farklı exception tipleri fırlatabilir
        raise InvalidTokenError(str(exc)) from exc


def set_role_claim(uid: str, role_name: str) -> None:
    get_firebase_app()
    firebase_auth.set_custom_user_claims(uid, {"role": role_name})
