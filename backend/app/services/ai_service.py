
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

_CHAT_SYSTEM_PROMPT = """Sen Plant AI platformunun akıllı ve uzlaşmacı kişisel bahçe asistanısın. 
Kullanıcıların genel bitki bakımı (sulama, ışık, hastalıklar vb.) sorularına yanıt verirken aynı zamanda oturum açan kullanıcının hesabındaki veritabanı bilgilerini (bahçesindeki bitkileri, son sipariş durumlarını, puanlarını, kuponlarını vb.) de takip eden bir asistansın.

ÖNEMLİ BİÇİMLENDİRME KURALI: Yanıtlarında asla yıldız (**kalın**, * italik) veya diyez (# başlık) gibi markdown sembolleri KULLANMA. Mobil ekranlar için metinleri temiz, okunabilir paragraflar ve renkli emojiler kullanarak düz metin olarak sun.

Eğer sana sağlanan veritabanı bağlamında kullanıcının siparişleri, bitkileri, puanları veya kuponları yer alıyorsa, kullanıcının bu konulardaki sorularına net, nazik, doğru ve Türkçe cevap ver.
Eğer kullanıcı genel bir bitki sorusu sorarsa genel uzmanlık bilginle yardımcı ol."""

_FALLBACK_ANALYSIS = {
    "species": "unknown",
    "health_status": "unknown",
    "confidence": 0.0,
    "care_recommendation": "Analiz sırasında bir sorun oluştu, lütfen tekrar deneyin.",
    "issues_detected": [],
    "recommended_products": [],
}


async def build_user_ai_context(db, user) -> str:
    """Builds a structured markdown text summary of the user's database records for Gemini AI context."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.customer import Ind, Org
    from app.models.customer_product import CustProd
    from app.models.order import CustOrd
    from app.models.campaign import UserCoupon
    from app.models.address import CustomerAddress

    ind_res = await db.execute(select(Ind).where(Ind.user_id == user.user_id))
    ind = ind_res.scalar_one_or_none()

    org_res = await db.execute(select(Org).where(Org.user_id == user.user_id))
    org = org_res.scalar_one_or_none()

    if ind:
        full_name = f"{ind.first_name or ''} {ind.last_name or ''}".strip() or ind.username or "Değerli Kullanıcı"
        email_str = ind.email or "Belirtilmemiş"
    elif org:
        full_name = org.store_name or org.company_name
        email_str = org.email or "Belirtilmemiş"
    else:
        full_name = "Değerli Kullanıcı"
        email_str = "Belirtilmemiş"

    context_lines = [
        "=== OTURUM AÇAN KULLANICI KİŞİSEL VERİTABANI BAĞLAMI ===",
        f"- Kullanıcı Adı: {full_name}",
        f"- E-posta: {email_str}",
        f"- Birikmiş Puan Bakiyesi: {user.points} Puan",
    ]
    if org and org.store_name:
        context_lines.append(f"- Mağaza Adı: {org.store_name}")

    # Addresses
    addr_res = await db.execute(
        select(CustomerAddress).where(CustomerAddress.user_id == user.user_id)
    )
    addresses = addr_res.scalars().all()
    if addresses:
        addr_str = "; ".join([f"{a.title}: {a.address_line}" for a in addresses])
        context_lines.append(f"- Kayıtlı Adresler: {addr_str}")

    # Bahçemdeki Bitkiler
    plants_res = await db.execute(
        select(CustProd)
        .options(selectinload(CustProd.specification))
        .where(CustProd.user_id == user.user_id)
        .order_by(CustProd.created_at.desc())
    )
    plants = plants_res.scalars().all()
    if plants:
        context_lines.append("\n[KULLANICININ BAHÇESİNDEKİ BİTKİLER (BAHÇEM)]")
        for p in plants:
            spec_name = p.specification.name if p.specification else "Genel Tür"
            loc = f" (Konum: {p.location})" if p.location else ""
            health_map = {
                "healthy": "Sağlıklı 🌿",
                "diseased": "Hasta 🩺",
                "pest_damage": "Zararlı Tehdidi Var 🐛"
            }
            h_text = health_map.get(p.health_status, p.health_status)
            
            last_w = p.last_watered_at.strftime("%d.%m.%Y") if p.last_watered_at else "Henüz sulanmadı"
            last_f = p.last_fertilized_at.strftime("%d.%m.%Y") if p.last_fertilized_at else "Gübrelenmedi"
            
            context_lines.append(
                f"• '{p.name}' [Tür: {spec_name}]{loc} | Sağlık: {h_text} | Sulama: Periyot {p.watering_interval_days} gün (Son Sulama: {last_w}) | Son Gübreleme: {last_f}"
            )
    else:
        context_lines.append("\n[KULLANICININ BAHÇESİNDEKİ BİTKİLER]")
        context_lines.append("Kullanıcının bahçesinde henüz kayıtlı bitkisi yok.")

    # Son Siparişler
    orders_res = await db.execute(
        select(CustOrd)
        .options(selectinload(CustOrd.items))
        .where(CustOrd.user_id == user.user_id)
        .order_by(CustOrd.order_date.desc())
        .limit(10)
    )
    orders = orders_res.scalars().all()

    STATUS_MAP = {
        5: "Sipariş Alındı 📦",
        6: "Hazırlanıyor ⏳",
        7: "Kargoda 🚚",
        8: "Teslim Edildi ✅",
        9: "İptal Edildi ❌",
    }

    if orders:
        context_lines.append("\n[KULLANICININ SON SİPARİŞLERİ]")
        for ord_obj in orders:
            st_text = STATUS_MAP.get(ord_obj.gnl_st_id, f"Durum Kodu: {ord_obj.gnl_st_id}")
            date_str = ord_obj.order_date.strftime("%d.%m.%Y %H:%M")

            items_list = [f"{item.prod_name} ({item.quantity} adet)" for item in ord_obj.items]
            items_str = ", ".join(items_list) if items_list else "Ürün detayı yok"
            context_lines.append(
                f"• Sipariş #{ord_obj.cust_ord_id} | Tarih: {date_str} | Tutar: ₺{ord_obj.total_price} | Durum: {st_text} | Ürünler: {items_str}"
            )
    else:

            context_lines.append("\n[KULLANICININ SON SİPARİŞLERİ]")
            context_lines.append("Kullanıcının henüz verilmiş bir siparişi bulunmuyor.")

    # Kuponlar
    coupons_res = await db.execute(
        select(UserCoupon)
        .where(UserCoupon.user_id == user.user_id, UserCoupon.is_used == False)
    )
    coupons = coupons_res.scalars().all()
    if coupons:
        context_lines.append("\n[KULLANICININ AKTİF KUPONLARI]")
        for c in coupons:
            context_lines.append(f"• Kod: {c.code} | İndirim Tutarı: ₺{c.discount_amount}")
    else:
        context_lines.append("\n[KULLANICININ AKTİF KUPONLARI]")
        context_lines.append("Aktif tanımlı kupon bulunmuyor.")

    return "\n".join(context_lines)


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


async def chat_reply(history: list[dict], new_message: str, user_context: str | None = None) -> str:
    try:
        system_instruction = _CHAT_SYSTEM_PROMPT
        if user_context:
            system_instruction += f"\n\nAşağıda oturum açan kullanıcının güncel veritabanı bilgileri yer almaktadır:\n\n{user_context}"

        model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL, system_instruction=system_instruction)
        chat = model.start_chat(history=history)
        response = chat.send_message(new_message)
        return response.text
    except Exception as e:
        print(f"⚠️ Gemini Chat API Hatası: {e}")
        return "Yapay zeka asistanı şu anda yanıt veremiyor. Lütfen API anahtarınızı kontrol edin."


async def process_user_action_intent(db, user, message: str) -> dict | None:
    """Checks if user message intends to execute a care action (water, fertilize, repot).
    If matched, updates the customer's plant record and logs the care action."""
    from datetime import datetime, timezone
    from sqlalchemy import select
    from app.models.customer import Cust
    from app.models.customer_product import CustProd, CustProdCareLog

    msg_lower = message.lower()

    action_type = None
    if any(k in msg_lower for k in ["suladım", "sula", "sulanma", "su verdim", "sulama yaptım"]):
        action_type = "water"
    elif any(k in msg_lower for k in ["gübreledim", "gübrele", "gübre verdim", "besledim", "besin verdim"]):
        action_type = "fertilize"
    elif any(k in msg_lower for k in ["saksı değiştirdim", "saksı değiştir", "saksısını değiştirdim", "yeni saksıya aldım"]):
        action_type = "repot"

    if not action_type:
        return None

    plants_res = await db.execute(
        select(CustProd).where(CustProd.user_id == user.user_id).order_by(CustProd.created_at.desc())
    )
    plants = plants_res.scalars().all()
    if not plants:
        return None


    # Try matching plant name in the message
    target_plant = None
    for p in plants:
        if p.name.lower() in msg_lower:
            target_plant = p
            break

    # If no specific name matched, default to the first plant
    if not target_plant:
        target_plant = plants[0]

    now_time = datetime.now(timezone.utc)

    if action_type == "water":
        target_plant.last_watered_at = now_time
        care_label = "Sulama"
    elif action_type == "fertilize":
        target_plant.last_fertilized_at = now_time
        care_label = "Gübreleme"
    elif action_type == "repot":
        target_plant.last_repotted_at = now_time
        care_label = "Saksı Değişimi"


    log = CustProdCareLog(
        cust_prod_id=target_plant.cust_prod_id,
        care_type=action_type,
        notes=f"{care_label} eylemi sohbet üzerinden kaydedildi. ({target_plant.name})"
    )
    db.add(log)
    await db.commit()

    return {
        "type": action_type,
        "plant_name": target_plant.name,
        "care_label": care_label,
        "success": True,
    }


async def find_recommended_products(db, user_message: str, ai_reply: str) -> list[dict]:
    """Finds catalog products from DB matching care, disease, fertilizer, or soil query terms."""
    from sqlalchemy import select
    from app.models.catalog import Prod

    text_corpus = f"{user_message} {ai_reply}".lower()
    keywords = ["gübre", "ilaç", "saksı", "toprak", "sprey", "zararlı", "neem", "besin", "gübresi", "bakım", "öneri"]
    
    if not any(k in text_corpus for k in keywords):
        return []

    res = await db.execute(select(Prod).where(Prod.stock > 0).limit(4))
    products = res.scalars().all()

    matched = []
    for p in products:
        matched.append({
            "prod_id": p.prod_id,
            "name": p.name,
            "price": p.price,
            "image_url": p.image_url,
            "stock": p.stock,
        })
    return matched[:2]



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


# ─── Admin AI Feature 8: Complaint Auto-Response Generator ──────────────────

_COMPLAINT_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "suggested_note": {"type": "string"}
    },
    "required": ["suggested_note"]
}

async def generate_complaint_response(
    complaint_title: str,
    complaint_description: str,
    complaint_type: str,
    target_status: str,
    user_name: str | None = None,
    product_name: str | None = None,
    reported_seller_name: str | None = None,
) -> dict:
    """Gemini generates a professional, polite, and helpful resolution response for a complaint."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    
    status_meanings = {
        "pending": "Şikayet beklemede. Müşteriye şikayet talebinin ulaştığını, en kısa sürede inceleme sırasına alınacağını belirt.",
        "in_progress": "Şikayet şu anda inceleniyor/araştırılıyor aşamasında. Kullanıcıya konuyu incelediğimizi ve en kısa sürede çözmek için çalıştığımızı belirt.",
        "resolved": "Şikayet çözüldü. Kullanıcıya sorunun çözüldüğünü (veya varsa para iadesi/satıcı uyarısı gibi detayları) belirt ve teşekkür et.",
        "rejected": "Şikayet reddedildi. Kullanıcıya şikayetinin neden kabul edilmediğini nazik ve kurallara uygun şekilde açıkla."
    }
    
    status_desc = status_meanings.get(target_status, "Destek talebi güncellendi.")
    
    ref_info = ""
    if user_name:
        ref_info += f"- Müşteri Adı: {user_name}\n"
    if complaint_type == "product" and product_name:
        ref_info += f"- Şikayet Edilen Ürün: {product_name}\n"
    if complaint_type == "seller" and reported_seller_name:
        ref_info += f"- Şikayet Edilen Satıcı: {reported_seller_name}\n"

    prompt = f"""Sen bir bitki alım-satım ve AI teşhis platformunun Müşteri İlişkileri ve Destek yöneticisisin.
Aşağıda bilgileri verilen kullanıcı destek/şikayet talebine yönelik Türkçe, son derece profesyonel, yapıcı ve samimi bir yanıt taslağı hazırla.

📋 Şikayet Detayları:
- Şikayet Başlığı: "{complaint_title}"
- Şikayet Açıklaması: "{complaint_description}"
- Şikayet Türü: {complaint_type}
{ref_info}

🎯 Şikayetin Güncellenecek Hedef Durumu:
{target_status} ({status_desc})

SADECE aşağıdaki JSON formatında yanıt ver:
{{
  "suggested_note": "Yazılacak yanıt metni (Kullanıcıya hitap ederek başla, Türkçe)"
}}"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": _COMPLAINT_RESPONSE_SCHEMA,
            },
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Gemini Complaint Response Hatası: {e}")
        return {"suggested_note": "Talebiniz alınmış olup incelenmektedir. En kısa sürede bilgi verilecektir."}


# ─── Admin AI Feature 9: Complaint Initial Analysis ─────────────────────────

_COMPLAINT_ANALYSIS_SCHEMA = {
    "type": "object",
    "properties": {
        "sentiment": {"type": "string"},
        "urgency": {"type": "string"},
        "ai_summary": {"type": "string"},
        "ai_tags": {"type": "array", "items": {"type": "string"}}
    },
    "required": ["sentiment", "urgency", "ai_summary", "ai_tags"]
}

async def analyze_new_complaint(title: str, description: str, complaint_type: str) -> dict:
    """Gemini analyzes a new complaint to determine sentiment, urgency, tags, and summary."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    
    prompt = f"""Bir müşteri destek sistemine yeni bir şikayet/destek talebi girildi.
Bu talebi analiz ederek duygu durumunu, aciliyet derecesini, 1-2 cümlelik kısa bir özetini ve konu etiketlerini belirle.

Talep Bilgileri:
- Başlık: "{title}"
- Açıklama: "{description}"
- Tür: {complaint_type}

Değerlendirme Kriterleri:
1. sentiment: Müşterinin ses tonu çok agresif, kızgın veya sert ise 'angry', üzgün veya hayal kırıklığına uğramış ise 'sad', sakin ve düz bir geri bildirim ise 'neutral'.
2. urgency: Ödeme/para iadesi sorunları, dolandırıcılık şüphesi veya kargo ulaşmaması gibi acil çözülmesi gereken finansal/operasyonel krizlerde 'high', orta derecede aksaklıklarda 'medium', genel bilgi/öneri/küçük hatalarda 'low'.
3. ai_summary: Yönetici için 1-2 cümlelik Türkçe kısa özet.
4. ai_tags: Şikayeti tanımlayan 2-3 adet Türkçe kısa etiket (örn: ["kargo", "iade", "hasarlı_ürün"]).

SADECE aşağıdaki JSON formatında yanıt ver:
{{
  "sentiment": "angry | sad | neutral",
  "urgency": "high | medium | low",
  "ai_summary": "Türkçe yönetici özeti...",
  "ai_tags": ["etiket1", "etiket2"]
}}"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": _COMPLAINT_ANALYSIS_SCHEMA,
            },
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Gemini Complaint Analysis Hatası: {e}")
        return {
            "sentiment": "neutral",
            "urgency": "medium",
            "ai_summary": "Şikayet analizi yapılamadı.",
            "ai_tags": ["genel"]
        }


# ─── Admin AI Feature 10: Seller Risk Advisor ────────────────────────────────

_SELLER_RISK_SCHEMA = {
    "type": "object",
    "properties": {
        "risk_level": {"type": "string"},
        "risk_label": {"type": "string"},
        "analysis": {"type": "string"},
        "recommendation": {"type": "string"}
    },
    "required": ["risk_level", "risk_label", "analysis", "recommendation"]
}

async def generate_seller_risk_advice(
    seller_name: str,
    total_complaints: int,
    pending_count: int,
    resolved_count: int,
    recent_types: list[str],
) -> dict:
    """Gemini evaluates the historical complaints against a seller and suggests an action plan."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)
    
    types_text = ", ".join(recent_types) if recent_types else "Bilinmiyor"
    
    prompt = f"""Sen bir bitki alım-satım platformunun risk yönetimi analistisin.
Aşağıda şikayet geçmişi verilen satıcıyı değerlendirerek yöneticimiz (Admin) için bir risk analizi ve öneri planı hazırla.

Satıcı Adı: "{seller_name}"
İstatistikler:
- Toplam Şikayet Sayısı: {total_complaints}
- Çözülmemiş / Bekleyen Şikayet: {pending_count}
- Çözülmüş / Kapatılmış Şikayet: {resolved_count}
- Son Şikayet Türleri: [{types_text}]

Değerlendirme Kriterleri:
1. risk_level: Satıcının risk seviyesini belirle ('low', 'medium' veya 'high'). Toplam şikayet sayısı 5'ten fazla ise ve çözülmemiş sayısı yüksekse 'high', 2-4 arası ise 'medium', 0-1 ise 'low' seçebilirsin.
2. risk_label: Türkçe karşılığı ('Düşük Risk', 'Orta Risk', 'Yüksek Risk').
3. analysis: Satıcının şikayet geçmişine dair Türkçe 2-3 cümlelik durum analizi.
4. recommendation: Yöneticiye yönelik somut tavsiye eylemi (örn. 'Satıcıyla iletişime geçip uyarın', 'Mağazayı 3 gün askıya alın', 'Herhangi bir aksiyona gerek yok').

SADECE aşağıdaki JSON formatında yanıt ver:
{{
  "risk_level": "low | medium | high",
  "risk_label": "Düşük Risk | Orta Risk | Yüksek Risk",
  "analysis": "Durum analizi...",
  "recommendation": "Tavsiye eylem..."
}}"""
    try:
        response = model.generate_content(
            prompt,
            generation_config={
                "response_mime_type": "application/json",
                "response_schema": _SELLER_RISK_SCHEMA,
            },
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"⚠️ Gemini Seller Risk Advice Hatası: {e}")
        return {
            "risk_level": "medium",
            "risk_label": "Orta Risk (Hata)",
            "analysis": "Satıcı geçmiş şikayet verileri şu anda analiz edilemiyor.",
            "recommendation": "Gelişmeleri takip etmeye devam edin."
        }






async def generate_seller_report(stats: dict) -> str:
    """Saticinin kendi magaza verilerini analiz eden Turkce AI raporu."""
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL)

    def _fmt(rows: list[dict], value_key: str, suffix: str = "") -> str:
        if not rows:
            return "  (veri yok)"
        return "\n".join(f"  - {r['name']}: {r[value_key]}{suffix}" for r in rows)

    prompt = f"""Sen Plant AI platformunda satıcılara özel çalışan bir mağaza analisti asistanısın.
Aşağıdaki gerçek verileri analiz edip satıcıya yol gösteren bir rapor hazırla.

📦 Genel Durum:
- Toplam ürün sayısı: {stats.get('total_products', 0)}
- Aktif (satıştaki) ürün: {stats.get('active_products', 0)}
- Stoğu biten ürün: {stats.get('out_of_stock', 0)}
- Toplam sipariş kalemi: {stats.get('total_order_items', 0)}
- Teslim edilen sipariş: {stats.get('delivered_orders', 0)}
- İptal edilen sipariş: {stats.get('cancelled_orders', 0)}
- Toplam ciro: {stats.get('total_revenue', 0)} TL
- Ortalama ürün puanı: {stats.get('avg_rating', 'veri yok')}
- Toplam yorum sayısı: {stats.get('review_count', 0)}

🔥 En çok sipariş edilen ürünler:
{_fmt(stats.get('top_products', []), 'qty', ' adet')}

❌ En çok iptal edilen ürünler:
{_fmt(stats.get('cancelled_products', []), 'qty', ' adet')}

⭐ En düşük puanlı ürünler:
{_fmt(stats.get('low_rated', []), 'rating', ' yıldız')}

Raporu şu başlıklar altında yaz:
**📈 Mağaza Performansı** - Verilerin kısa yorumu
**🔥 Öne Çıkan Ürünler** - Neyin iyi gittiği ve nedeni
**⚠️ Sorunlu Alanlar** - İptaller, düşük puanlar, stok sorunları
**🚀 Mağazanı Öne Çıkarmak İçin** - 3-4 SOMUT, uygulanabilir öneri
(örn. fiyat/stok ayarı, hangi ürüne kampanya, hangi ürünün görseli/açıklaması iyileştirilmeli)

Türkçe, samimi ama profesyonel, emoji kullan. Veri azsa bunu dürüstçe belirt ve
satıcının ne yapması gerektiğini yine de söyle."""
    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"⚠️ Gemini Seller Report Hatası: {e}")
        return "Mağaza raporu şu anda oluşturulamıyor. Lütfen daha sonra tekrar deneyin."
