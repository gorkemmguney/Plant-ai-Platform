import requests

API_KEY = "AIzaSyAlVcSvhFXZ_8vIVSkutUeueQ1sjAALkHo"
EMAIL = "test@plantai.com"
PASSWORD = "Test123456!"

def sign_up_or_sign_in():
    # Önce kayıt olmayı dene
    signup_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
    payload = {"email": EMAIL, "password": PASSWORD, "returnSecureToken": True}
    resp = requests.post(signup_url, json=payload)

    if resp.status_code == 200:
        print("✅ Yeni test kullanıcısı oluşturuldu.")
        return resp.json()

    # Zaten varsa giriş yap
    signin_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
    resp = requests.post(signin_url, json=payload)
    resp.raise_for_status()
    print("✅ Mevcut test kullanıcısıyla giriş yapıldı.")
    return resp.json()

data = sign_up_or_sign_in()
print("\n--- ID TOKEN (Swagger'da 'Authorize' için kullanın) ---\n")
print(data["idToken"])
print("\n--- Kullanıcı bilgisi ---")
print("Email:", data.get("email"))
print("Local ID (UID):", data.get("localId"))
