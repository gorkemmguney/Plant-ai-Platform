import requests

API_KEY = "AIzaSyAlVcSvhFXZ_8vIVSkutUeueQ1sjAALkHo"
EMAIL = "admin@plantai.com"
PASSWORD = "Admin123456!"

signin_url = f"https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key={API_KEY}"
resp = requests.post(signin_url, json={"email": EMAIL, "password": PASSWORD, "returnSecureToken": True})

if resp.status_code != 200:
    print("❌ Hata:", resp.status_code, resp.json())
else:
    data = resp.json()
    print(data["idToken"])
