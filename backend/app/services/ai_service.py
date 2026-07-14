
import json

import google.generativeai as genai

from app.core.config import get_settings

settings = get_settings()
genai.configure(api_key=settings.GEMINI_API_KEY)

_VISION_PROMPT = """Sen bir bitki uzmanısın. Görseldeki bitkiyi analiz et.
SADECE aşağıdaki JSON formatında, başka hiçbir açıklama eklemeden, bir NESNE (obje) olarak yanıt ver (liste/array DEĞİL):
{
  "species": "bitkinin türü (Türkçe ve bilimsel isim)",
  "health_status": "healthy | diseased | pest_damage | unknown",
  "confidence": 0.0-1.0 arası bir sayı,
  "care_recommendation": "kısa, pratik bakım önerisi (Türkçe)",
  "issues_detected": ["varsa tespit edilen sorunlar"],
  "recommended_products": ["Bu bitkinin sorunlarını çözmek veya bakımını yapmak için kullanıcının satın alabileceği genel ürün adları (Türkçe, örn: Neem Yağı, Sıvı Besin Gübresi, Tropikal Bitki Toprağı)"]
}"""

_VISION_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "species": {"type": "string"},
        "health_status": {"type": "string"},
        "confidence": {"type": "number"},
        "care_recommendation": {"type": "string"},
        "issues_detected": {"type": "array", "items": {"type": "string"}},
        "recommended_products": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["species", "health_status", "confidence", "care_recommendation"],
}

_CHAT_SYSTEM_PROMPT = """Sen bir bitki bakım asistanısın. Kullanıcıların bitki
alım-satım platformunda bitkilerle ilgili sorularını (bakım, sulama, ışık,
hastalık, saksı/toprak seçimi vb.) kısa, net ve Türkçe olarak yanıtla."""

_FALLBACK_ANALYSIS = {
    "species": "unknown",
    "health_status": "unknown",
    "confidence": 0.0,
    "care_recommendation": "Analiz sırasında bir sorun oluştu, lütfen tekrar deneyin.",
    "issues_detected": [],
    "recommended_products": [],
}


async def analyze_plant_image(image_bytes: bytes, mime_type: str) -> dict:
    model = genai.GenerativeModel(settings.GEMINI_VISION_MODEL)
    
    try:
        response = model.generate_content(
            [_VISION_PROMPT, {"mime_type": mime_type, "data": image_bytes}],
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": _VISION_RESPONSE_SCHEMA,
            },
        )
        parsed = json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Gemini Vision API Hatası: {e}")
        return _FALLBACK_ANALYSIS

    if isinstance(parsed, list):
        parsed = parsed[0] if parsed and isinstance(parsed[0], dict) else _FALLBACK_ANALYSIS

    if not isinstance(parsed, dict):
        return _FALLBACK_ANALYSIS

    return parsed


async def chat_reply(history: list[dict], new_message: str) -> str:
    try:
        model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL, system_instruction=_CHAT_SYSTEM_PROMPT)
        chat = model.start_chat(history=history)
        response = chat.send_message(new_message)
        return response.text
    except Exception as e:
        print(f"⚠️ Gemini Chat API Hatası: {e}")
        return "Yapay zeka asistanı şu anda yanıt veremiyor. Lütfen API anahtarınızı kontrol edin."


# ─── Admin AI Feature 1: Announcement Draft Wizard ─────────────────────────

_DRAFT_ANNOUNCEMENT_SCHEMA = {
    "type": "object",
    "properties": {
        "title": {"type": "string"},
        "message": {"type": "string"},
    },
    "required": ["title", "message"],
}

async def draft_announcement(topic: str) -> dict:
    """Gemini generates a professional Turkish push notification draft from a short topic idea."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    prompt = f"""Sen bir bitki alım-satım uygulamasının pazarlama uzmanısın.
Admin şu konuda bir uygulama içi duyuru yazmak istiyor: "{topic}"

SADECE aşağıdaki JSON formatında, başka hiçbir açıklama eklemeden yanıt ver:
{{
  "title": "Push bildirim başlığı (maks 60 karakter, Türkçe, dikkat çekici emoji ile başlasın)",
  "message": "Bildirim gövde metni (maks 200 karakter, Türkçe, sıcak ve samimi bir dil)"
}}"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": _DRAFT_ANNOUNCEMENT_SCHEMA,
            },
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Gemini Draft Announcement Hatası: {e}")
        return {"title": "Duyuru", "message": topic}


# ─── Admin AI Feature 2: Platform Insights ──────────────────────────────────

async def generate_platform_insights(stats: dict) -> str:
    """Gemini analyses platform stats and returns Turkish business advice."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    prompt = f"""Sen bir bitki alım-satım platformunun (Plant AI) iş analistisisin.
Aşağıdaki güncel platform istatistiklerini analiz et ve yöneticiye kısa, eyleme geçirilebilir Türkçe tavsiyeler sun.

Platform İstatistikleri:
- Toplam Kullanıcı: {stats.get('total_users', 0)}
- Onaylı Satıcı: {stats.get('total_sellers', 0)}
- AI Bitki Teşhisi Yapılan: {stats.get('total_analyses', 0)}
- Platformdaki Ürün: {stats.get('total_products', 0)}
- Son 7 günde yapılan teşhis: {stats.get('recent_analyses', 0)}
- En sık tespit edilen sorun: {stats.get('top_issue', 'Veri yok')}

Bana 3-4 cümlelik, yönetici için özet bir iş raporu ve 2-3 somut öneri yaz. 
Madde işareti kullan, emoji ekle, Türkçe yaz."""
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"⚠️ Gemini Insights Hatası: {e}")
        return "Platform analizi şu anda yapılamıyor. Lütfen daha sonra tekrar deneyin."


# ─── Admin AI Feature 3: Seller Risk Profiler ───────────────────────────────

_SELLER_PROFILE_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string"},
        "verdict_label": {"type": "string"},
        "summary": {"type": "string"},
        "risk_score": {"type": "integer"},
    },
    "required": ["verdict", "verdict_label", "summary", "risk_score"],
}

async def profile_seller(email: str, first_name: str, last_name: str) -> dict:
    """Gemini analyses seller registration data and returns a risk profile."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    prompt = f"""Sen bir e-ticaret platformunun satıcı başvurularını değerlendiren yapay zeka asistanısın.
Aşağıdaki satıcı başvurusunu analiz et ve bir risk değerlendirmesi yap.

Başvuru Bilgileri:
- Ad: {first_name}
- Soyad: {last_name}
- E-posta: {email}

E-posta adresini analiz et: alan adı güvenilir mi (gmail, outlook, hotmail güvenilir; rastgele karakterli alan adları şüpheli)?
İsim-soyad kombinasyonu gerçekçi mi?
SADECE şu JSON formatında yanıt ver:
{{
  "verdict": "safe | suspicious | review",
  "verdict_label": "Güvenli | Şüpheli | İnceleme Önerilir",
  "summary": "2 cümle Türkçe açıklama",
  "risk_score": 0-100 arası integer (0=tamamen güvenli, 100=çok riskli)
}}"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": _SELLER_PROFILE_SCHEMA,
            },
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Gemini Seller Profile Hatası: {e}")
        return {
            "verdict": "review",
            "verdict_label": "İnceleme Önerilir",
            "summary": "Profil analizi şu anda yapılamıyor.",
            "risk_score": 50,
        }


# ─── Admin AI Feature 4: Diagnosis Center Commentary ────────────────────────

async def generate_diagnosis_commentary(disease_stats: list[dict], total: int) -> str:
    """Gemini analyses platform-wide disease data and returns admin insights."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    stats_text = "\n".join(
        f"- {d['disease']}: {d['count']} vaka ({d['percentage']:.1f}%)"
        for d in disease_stats[:10]
    )
    prompt = f"""Sen bir bitki sağlığı platformunun yapay zeka analistisisin.
Platform genelinde toplam {total} bitki teşhisi yapıldı. En sık görülen hastalık/durum dağılımı:

{stats_text}

Bu verileri analiz et ve yöneticiye:
1. Hangi hastalığın salgın riski taşıdığını
2. Satıcılara hangi ürünleri öne çıkarmaları gerektiğini
3. Kullanıcıları bilinçlendirmek için ne yapılabileceğini

Kısa (3-4 madde), madde işaretli, emoji'li, Türkçe bir analiz yaz."""
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"⚠️ Gemini Diagnosis Commentary Hatası: {e}")
        return "Teşhis analizi şu anda yapılamıyor."


# ─── Admin AI Feature 5: Product Content Moderation ─────────────────────────

_CONTENT_MOD_SCHEMA = {
    "type": "object",
    "properties": {
        "verdict": {"type": "string"},
        "verdict_label": {"type": "string"},
        "reason": {"type": "string"},
        "risk_score": {"type": "integer"},
    },
    "required": ["verdict", "verdict_label", "reason", "risk_score"],
}

async def moderate_product_content(title: str, description: str) -> dict:
    """Gemini reviews a product listing for inappropriate or misleading content."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    prompt = f"""Sen bir e-ticaret platformunun içerik denetçisisin.
Aşağıdaki ürün ilanını incele ve uygunluğunu değerlendir.

Ürün Adı: {title}
Açıklama: {description or 'Açıklama girilmemiş'}

Değerlendirme kriterleri:
- Abartılı/yanıltıcı sağlık/verim iddiaları var mı?
- Uygunsuz, hakaret içeren veya spam içerik var mı?
- Yasal sorun çıkarabilecek ifadeler var mı?
- Açıklama yetersiz veya anlamsız mı?

SADECE şu JSON formatında yanıt ver:
{{
  "verdict": "ok | warning | violation",
  "verdict_label": "Uygun | Dikkat Gerektiriyor | İhlal",
  "reason": "1-2 cümle Türkçe açıklama",
  "risk_score": 0-100 integer
}}"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": _CONTENT_MOD_SCHEMA,
            },
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Gemini Content Moderation Hatası: {e}")
        return {"verdict": "warning", "verdict_label": "Dikkat Gerektiriyor", "reason": "İçerik analizi yapılamadı.", "risk_score": 50}


# ─── Admin AI Feature 6: Period Report ──────────────────────────────────────

async def generate_period_report(period_days: int, stats: dict) -> str:
    """Gemini generates a comprehensive Turkish period report for admins."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    prompt = f"""Sen Plant AI platformunun yapay zeka raporlama asistanısın.
Son {period_days} günün platform verilerini analiz et ve yönetici için kapsamlı bir rapor hazırla.

📊 Dönem İstatistikleri ({period_days} gün):
- Yeni Kullanıcı: {stats.get('new_users', 0)}
- Toplam AI Teşhis: {stats.get('total_analyses', 0)}
- Dönem İçi Yeni Teşhis: {stats.get('recent_analyses', 0)}
- Yeni Satıcı Başvurusu: {stats.get('new_sellers', 0)}
- Toplam Ürün: {stats.get('total_products', 0)}

Raporu şu başlıklar altında yaz:
**📈 Genel Performans** - Dönemin özeti
**🌿 Platform Sağlığı** - AI kullanımı ve büyüme
**⚠️ Dikkat Edilmesi Gerekenler** - Varsa endişe noktaları
**✅ Önerilen Aksiyonlar** - 2-3 somut öneri

Türkçe, profesyonel, emoji'li yaz."""
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"⚠️ Gemini Period Report Hatası: {e}")
        return "Dönem raporu şu anda oluşturulamıyor."


# ─── Admin AI Feature 7: Campaign Template Generator ────────────────────────

_CAMPAIGN_SCHEMA = {
    "type": "object",
    "properties": {
        "notification_title": {"type": "string"},
        "notification_template": {"type": "string"},
        "recommended_product": {"type": "string"}
    },
    "required": ["notification_title", "notification_template", "recommended_product"]
}

async def generate_campaign_template(top_disease: str) -> dict:
    """Gemini generates an engaging personalized notification title and template based on a disease name."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    prompt = f"""Sen bir bitki e-ticaret platformunun pazarlama yöneticisisin.
Son dönemde platformda en çok tespit edilen hastalık/sorun: "{top_disease}"

Bu soruna sahip kullanıcılara yönelik son derece ilgi çekici, kişiselleştirilmiş bir bildirim başlığı ve bildirim gövdesi hazırla.
Gövde metninde kullanıcının adı için dinamik olarak "{{first_name}}" değişkenini kullan. 

Örnek çıktı:
Başlık: "🌿 Bitkinde Leke Mi Var?"
Gövde: "Merhaba {{first_name}}, bu hafta platformda Külleme Hastalığı teşhislerinde artış oldu. Bitkini korumak için Neem Yağı ürünlerimizde indirim başladı!"

SADECE aşağıdaki JSON formatında yanıt ver:
{{
  "notification_title": "Bitkinizin Sağlığı İçin Başlık (maks 60 karakter, Türkçe)",
  "notification_template": "Merhaba {{first_name}}, ile başlayan gövde metni (maks 200 karakter, Türkçe)",
  "recommended_product": "Bu hastalık için önerilen ana ürün adı (örn: Neem Yağı)"
}}"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": _CAMPAIGN_SCHEMA,
            },
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Gemini Campaign Hatası: {e}")
        return {
            "notification_title": "🌿 Bitki Bakım Kampanyası",
            "notification_template": "Merhaba {first_name}, bitkilerini korumak için en popüler ürünlerimizde indirim başladı!",
            "recommended_product": "Genel Bitki Gübresi"
        }


