import requests

API_KEY = "AIzaSyAlVcSvhFXZ_8vIVSkutUeueQ1sjAALkHo"
EMAIL = "admin@plantai.com"
PASSWORD = "Admin123456!"

signup_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
resp = requests.post(signup_url, json={"email": EMAIL, "password": PASSWORD, "returnSecureToken": True})

if resp.status_code != 200:
    print("❌ Hata:", resp.status_code, resp.json())
else:
    data = resp.json()
    print("✅ Oluşturuldu. UID:", data["localId"])
    print("\n--- ID TOKEN ---\n")
    print(data["idToken"])
