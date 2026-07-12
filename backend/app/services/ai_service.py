
import json

import google.generativeai as genai

from app.core.config import get_settings

settings = get_settings()
genai.configure(api_key=settings.GEMINI_API_KEY)

_VISION_PROMPT = """Sen bir bitki uzmanısın. Görseldeki bitkiyi analiz et ve SADECE
aşağıdaki JSON formatında, başka hiçbir açıklama eklemeden, bir NESNE (obje) olarak
yanıt ver (liste/array DEĞİL):
{
  "species": "bitkinin türü (Türkçe ve bilimsel isim)",
  "health_status": "healthy | diseased | pest_damage | unknown",
  "confidence": 0.0-1.0 arası bir sayı,
  "care_recommendation": "kısa, pratik bakım önerisi (Türkçe)",
  "issues_detected": ["varsa tespit edilen sorunlar"]
}"""

_VISION_RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "species": {"type": "string"},
        "health_status": {"type": "string"},
        "confidence": {"type": "number"},
        "care_recommendation": {"type": "string"},
        "issues_detected": {"type": "array", "items": {"type": "string"}},
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
}


async def analyze_plant_image(image_bytes: bytes, mime_type: str) -> dict:
    model = genai.GenerativeModel(settings.GEMINI_VISION_MODEL)
    response = model.generate_content(
        [_VISION_PROMPT, {"mime_type": mime_type, "data": image_bytes}],
        generation_config={
            "response_mime_type": "application/json",
            "response_schema": _VISION_RESPONSE_SCHEMA,
        },
    )
    try:
        parsed = json.loads(response.text)
    except (json.JSONDecodeError, AttributeError):
        return _FALLBACK_ANALYSIS

    if isinstance(parsed, list):
        parsed = parsed[0] if parsed and isinstance(parsed[0], dict) else _FALLBACK_ANALYSIS

    if not isinstance(parsed, dict):
        return _FALLBACK_ANALYSIS

    return parsed


async def chat_reply(history: list[dict], new_message: str) -> str:
    
    model = genai.GenerativeModel(settings.GEMINI_CHAT_MODEL, system_instruction=_CHAT_SYSTEM_PROMPT)
    chat = model.start_chat(history=history)
    response = chat.send_message(new_message)
    return response.text
