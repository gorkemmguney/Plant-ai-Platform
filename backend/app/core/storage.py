import uuid

from firebase_admin import storage

from app.core.firebase import get_firebase_app


def upload_image(file_bytes: bytes, content_type: str, folder: str = "plant-images") -> str:
    get_firebase_app()
    bucket = storage.bucket()
    blob_name = f"{folder}/{uuid.uuid4().hex}"
    blob = bucket.blob(blob_name)
    blob.upload_from_string(file_bytes, content_type=content_type)
    blob.make_public()
    return blob.public_url
