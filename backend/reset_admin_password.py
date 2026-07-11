import firebase_admin
from firebase_admin import credentials, auth

cred = credentials.Certificate("firebase-service-account.json")
firebase_admin.initialize_app(cred, {"projectId": "plant-ai-platform"})

EMAIL = "mert@test.com"
NEW_PASSWORD = "Test123456!"

user = auth.get_user_by_email(EMAIL)
auth.update_user(user.uid, password=NEW_PASSWORD)
print(f"✅ Şifre güncellendi. UID: {user.uid}")
