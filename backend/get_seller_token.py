import requests

API_KEY = "AIzaSyAlVcSvhFXZ_8vIVSkutUeueQ1sjAALkHo"

EMAIL = "seller2@plantai.com"
PASSWORD = "123456"

SIGN_UP_URL = (
    f"https://identitytoolkit.googleapis.com/v1/accounts:signUp?key={API_KEY}"
)

SIGN_IN_URL = (
    f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
)

payload = {
    "email": EMAIL,
    "password": PASSWORD,
    "returnSecureToken": True,
}


def authenticate():
    response = requests.post(SIGN_UP_URL, json=payload)

    if response.ok:
        print("✅ Seller hesabı oluşturuldu.")
        return response.json()

    response = requests.post(SIGN_IN_URL, json=payload)

    if response.ok:
        print("✅ Seller hesabına giriş yapıldı.")
        return response.json()

    raise Exception(response.json())


data = authenticate()

print("\n=== SELLER BİLGİLERİ ===")
print(f"Email : {data['email']}")
print(f"UID   : {data['localId']}")
print("\nID Token:\n")
print(data["idToken"])