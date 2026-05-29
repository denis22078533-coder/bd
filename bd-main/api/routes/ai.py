"""Эндпоинты AI: настройки, чат, распознавание документов."""
import concurrent.futures
import json
import os
import re
import traceback
import urllib.error
import urllib.request
from datetime import date
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from api.database.connection import get_cursor, SCHEMA
from api.utils.formatters import mask_key

router = APIRouter(tags=["ai"])

# ═══════════════════════════════════════════════════════════════════
#  Конфигурация AI-провайдеров
# ═══════════════════════════════════════════════════════════════════

DIRECT_ENDPOINTS = {
    "deepseek-chat": "https://api.deepseek.com/v1/chat/completions",
    "deepseek-reasoner": "https://api.deepseek.com/v1/chat/completions",
    "gpt-4o": "https://api.openai.com/v1/chat/completions",
    "gpt-4o-mini": "https://api.openai.com/v1/chat/completions",
    "gpt-4-turbo": "https://api.openai.com/v1/chat/completions",
    "claude-3-5-sonnet": "https://api.anthropic.com/v1/messages",
    "gemini-pro": "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent",
}

PROXYAPI_BASE = "https://api.proxyapi.ru"
PROXYAPI_ENDPOINTS = {
    "proxyapi-gpt-4o": f"{PROXYAPI_BASE}/openai/v1/chat/completions",
    "proxyapi-gpt-4o-mini": f"{PROXYAPI_BASE}/openai/v1/chat/completions",
    "proxyapi-gpt-4-turbo": f"{PROXYAPI_BASE}/openai/v1/chat/completions",
    "proxyapi-claude-3-5-sonnet": f"{PROXYAPI_BASE}/anthropic/v1/messages",
    "proxyapi-claude-3-haiku": f"{PROXYAPI_BASE}/anthropic/v1/messages",
    "proxyapi-gemini-1.5-pro": f"{PROXYAPI_BASE}/google/v1beta/models/gemini-1.5-pro:generateContent",
    "proxyapi-gemini-2.0-flash": f"{PROXYAPI_BASE}/google/v1beta/models/gemini-2.0-flash:generateContent",
}

PROXYAPI_MODEL_NAMES = {
    "proxyapi-gpt-4o": "gpt-4o",
    "proxyapi-gpt-4o-mini": "gpt-4o-mini",
    "proxyapi-gpt-4-turbo": "gpt-4-turbo",
    "proxyapi-claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
    "proxyapi-claude-3-haiku": "claude-3-haiku-20240307",
    "proxyapi-gemini-1.5-pro": "gemini-1.5-pro",
    "proxyapi-gemini-2.0-flash": "gemini-2.0-flash",
}

DEFAULT_SYSTEM = (
    "Ты финансовый ИИ-ассистент для B2B компании ФинансПро. "
    "Помогаешь анализировать финансы, объяснять данные, создавать операции и отчёты. "
    "Отвечай профессионально, кратко и по делу. "
    "Форматируй суммы в рублях (₽). "
    "Используй markdown для выделения важных данных — **жирный** для ключевых цифр."
)


# ═══════════════════════════════════════════════════════════════════
#  Вспомогательные функции для тестирования AI
# ═══════════════════════════════════════════════════════════════════

def test_proxyapi(model: str, proxyapi_key: str) -> dict:
    if not proxyapi_key:
        return {"ok": False, "error": "Ключ ProxyAPI не задан"}
    if model not in PROXYAPI_ENDPOINTS:
        return {"ok": False, "error": f"Модель {model} не поддерживается"}
    url = PROXYAPI_ENDPOINTS[model]
    real_model = PROXYAPI_MODEL_NAMES[model]
    if model.startswith("proxyapi-gpt"):
        payload = {"model": real_model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 5}
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {proxyapi_key}"}
    elif model.startswith("proxyapi-claude"):
        payload = {"model": real_model, "max_tokens": 5, "messages": [{"role": "user", "content": "ping"}]}
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {proxyapi_key}", "anthropic-version": "2023-06-01"}
    else:
        payload = {"contents": [{"parts": [{"text": "ping"}]}]}
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {proxyapi_key}"}
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=20) as r:
            return {"ok": True, "status": r.status}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            err_data = json.loads(body)
            msg = err_data.get("error", {}).get("message") if isinstance(err_data.get("error"), dict) else err_data.get("error") or err_data.get("message") or body[:300]
        except Exception:
            msg = body[:300]
        return {"ok": False, "error": f"HTTP {e.code}: {msg}"}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


def test_direct(model: str, api_key: str) -> dict:
    url = DIRECT_ENDPOINTS.get(model)
    if not url:
        return {"ok": False, "error": f"Модель {model} не поддерживается"}
    if not api_key:
        return {"ok": False, "error": "API ключ не задан"}
    if model.startswith("deepseek") or model.startswith("gpt"):
        payload = {"model": model, "messages": [{"role": "user", "content": "ping"}], "max_tokens": 5}
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}
    elif model.startswith("claude"):
        payload = {"model": "claude-3-5-sonnet-20241022", "max_tokens": 5, "messages": [{"role": "user", "content": "ping"}]}
        headers = {"Content-Type": "application/json", "x-api-key": api_key, "anthropic-version": "2023-06-01"}
    else:
        url = url + f"?key={api_key}"
        payload = {"contents": [{"parts": [{"text": "ping"}]}]}
        headers = {"Content-Type": "application/json"}
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=15) as r:
            return {"ok": True, "status": r.status}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        try:
            err_data = json.loads(body)
            msg = err_data.get("error", {}).get("message") or err_data.get("error") or body[:200]
        except Exception:
            msg = body[:200]
        return {"ok": False, "error": f"HTTP {e.code}: {msg}"}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


def test_yandex(yandex_key: str, yandex_folder: str) -> dict:
    if not yandex_key:
        return {"ok": None, "error": "Ключ не задан"}
    if not yandex_folder:
        return {"ok": False, "error": "Folder ID не задан"}
    url = "https://ocr.api.cloud.yandex.net/ocr/v1/recognizeText"
    dummy_b64 = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////wAARCAAKAAoDASIAAhEBAxEB/8QAFAABAQAAAAAAAAAAAAAAAAAAAAr/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AL+AB//Z"
    payload = {"mimeType": "JPEG", "languageCodes": ["ru"], "model": "page", "content": dummy_b64}
    try:
        req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "Authorization": f"Api-Key {yandex_key}",
                     "x-folder-id": yandex_folder, "x-data-logging-enabled": "false"}, method="POST")
        with urllib.request.urlopen(req, timeout=15) as r:
            return {"ok": True, "status": r.status}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        if e.code == 400:
            return {"ok": True, "status": 400, "note": "Ключ валиден"}
        if e.code == 401:
            return {"ok": False, "error": "Ключ недействителен (401)."}
        if e.code == 403:
            return {"ok": False, "error": "Нет прав (403). Проверьте роли сервисного аккаунта."}
        return {"ok": False, "error": f"HTTP {e.code}: {body[:200]}"}
    except Exception as ex:
        return {"ok": False, "error": str(ex)}


# ═══════════════════════════════════════════════════════════════════
#  Функции вызова AI
# ═══════════════════════════════════════════════════════════════════

def _get_ai_settings(cur):
    cur.execute(f"""
        SELECT selected_model, api_key, gemini_api_key, yandex_api_key, yandex_folder_id,
               max_tokens, temperature, system_prompt, proxyapi_key, vision_provider
        FROM {SCHEMA}.ai_settings WHERE id = 1
    """)
    row = cur.fetchone()
    if not row:
        return None
    return {
        "selected_model": row[0],
        "deepseek_key": (row[1] or os.environ.get("DEEPSEEK_API_KEY", "")),
        "gemini_key": (row[2] or os.environ.get("GEMINI_API_KEY", "")),
        "yandex_key": (row[3] or os.environ.get("YANDEX_API_KEY", "")),
        "yandex_folder": (row[4] or os.environ.get("YANDEX_FOLDER_ID", "")),
        "max_tokens": row[5] or 1024,
        "temperature": float(row[6] or 0.3),
        "system_prompt": row[7] or "",
        "proxyapi_key": (row[8] or os.environ.get("PROXYAPI_KEY", "")),
        "vision_provider": row[9] or "proxyapi-gpt-4o",
    }


def call_deepseek(model, messages, api_key, system_prompt, max_tokens, temperature):
    payload = {"model": model,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "max_tokens": max_tokens, "temperature": temperature, "stream": False}
    req = urllib.request.Request("https://api.deepseek.com/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        result = json.loads(r.read().decode("utf-8"))
    return result["choices"][0]["message"]["content"]


def call_gemini(model, messages, api_key, system_prompt, max_tokens, temperature):
    gemini_model = "gemini-1.5-pro" if "pro" in model else "gemini-2.0-flash"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
    contents = []
    for m in messages:
        role = "user" if m.get("role") == "user" else "model"
        contents.append({"role": role, "parts": [{"text": m.get("content", "")}]})
    payload = {"systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": contents,
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens}}
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        result = json.loads(r.read().decode("utf-8"))
    return result["candidates"][0]["content"]["parts"][0]["text"]


def call_yandexgpt(messages, api_key, folder_id, system_prompt, max_tokens, temperature):
    url = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"
    yandex_messages = [{"role": "system", "text": system_prompt}]
    for m in messages:
        yandex_messages.append({"role": m.get("role", "user"), "text": m.get("content", "")})
    payload = {"modelUri": f"gpt://{folder_id}/yandexgpt/latest",
        "completionOptions": {"stream": False, "temperature": temperature, "maxTokens": max_tokens},
        "messages": yandex_messages}
    req = urllib.request.Request(url, data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Api-Key {api_key}",
                 "x-folder-id": folder_id}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        result = json.loads(r.read().decode("utf-8"))
    return result["result"]["alternatives"][0]["message"]["text"]


# ═══════════════════════════════════════════════════════════════════
#  AI Settings Endpoints
# ═══════════════════════════════════════════════════════════════════

@router.get("/api/ai-settings")
async def ai_settings_get(action: Optional[str] = Query(None)):
    with get_cursor() as cur:
        if action == "test":
            cur.execute(f"""
                SELECT selected_model, api_key, gemini_api_key, yandex_api_key, yandex_folder_id,
                       proxyapi_key, vision_provider FROM {SCHEMA}.ai_settings WHERE id = 1
            """)
            row = cur.fetchone()
            if not row:
                raise HTTPException(404, "Настройки не найдены")
            model = row[0]
            deepseek_key = row[1] or os.environ.get("DEEPSEEK_API_KEY", "")
            gemini_key = row[2] or os.environ.get("GEMINI_API_KEY", "")
            yandex_key = row[3] or os.environ.get("YANDEX_API_KEY", "")
            yandex_folder = row[4] or os.environ.get("YANDEX_FOLDER_ID", "")
            proxyapi_key = row[5] or os.environ.get("PROXYAPI_KEY", "")
            vision_provider = row[6] or "proxyapi-gpt-4o"

            if model.startswith("proxyapi-"):
                ai_result = test_proxyapi(model, proxyapi_key)
            elif model.startswith("gemini"):
                ai_result = test_direct(model, gemini_key)
            else:
                ai_result = test_direct(model, deepseek_key)

            if vision_provider.startswith("proxyapi-"):
                vision_result = test_proxyapi(vision_provider, proxyapi_key)
            elif vision_provider == "yandex":
                vision_result = test_yandex(yandex_key, yandex_folder)
            elif vision_provider == "gemini":
                vision_result = test_direct("gemini-pro", gemini_key) if gemini_key else {"ok": None, "error": "Ключ Gemini не задан"}
            else:
                vision_result = {"ok": None, "error": "Vision-провайдер не выбран"}

            overall_ok = bool(ai_result.get("ok")) and bool(vision_result.get("ok"))
            return {
                "ok": overall_ok, "ai_model": model, "ai": ai_result,
                "vision_provider": vision_provider, "vision": vision_result,
                "yandex": vision_result,
                "error": None if overall_ok else (vision_result.get("error") or ai_result.get("error")),
            }

        cur.execute(f"""
            SELECT selected_model, max_tokens, temperature, system_prompt, api_key, updated_at,
                   gemini_api_key, yandex_api_key, yandex_folder_id, proxyapi_key, vision_provider
            FROM {SCHEMA}.ai_settings WHERE id = 1
        """)
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Settings not found")

        gemini_key = row[6] or os.environ.get("GEMINI_API_KEY", "")
        yandex_key = row[7] or os.environ.get("YANDEX_API_KEY", "")
        yandex_folder = row[8] or os.environ.get("YANDEX_FOLDER_ID", "")
        proxyapi_key = row[9] or os.environ.get("PROXYAPI_KEY", "")
        vision_provider = row[10] or "proxyapi-gpt-4o"

        return {"settings": {
            "selected_model": row[0], "max_tokens": row[1], "temperature": float(row[2]),
            "system_prompt": row[3],
            "api_key_set": bool(row[4] or os.environ.get("DEEPSEEK_API_KEY")),
            "api_key_masked": mask_key(row[4] or os.environ.get("DEEPSEEK_API_KEY", "")),
            "gemini_key_set": bool(gemini_key),
            "gemini_key_masked": mask_key(gemini_key),
            "yandex_key_set": bool(yandex_key),
            "yandex_key_masked": mask_key(yandex_key),
            "yandex_folder_set": bool(yandex_folder),
            "yandex_folder_masked": mask_key(yandex_folder),
            "proxyapi_key_set": bool(proxyapi_key),
            "proxyapi_key_masked": mask_key(proxyapi_key),
            "vision_provider": vision_provider,
            "updated_at": str(row[5]),
        }}


@router.put("/api/ai-settings")
async def ai_settings_update(data: dict):
    with get_cursor() as cur:
        fields = []
        params = []
        for f in ["selected_model", "max_tokens", "temperature", "system_prompt", "vision_provider"]:
            if f in data and data[f] is not None:
                fields.append(f"{f} = %s")
                params.append(data[f])
        if data.get("api_key"):
            fields.append("api_key = %s"); params.append(data["api_key"])
        if data.get("gemini_api_key"):
            fields.append("gemini_api_key = %s"); params.append(data["gemini_api_key"])
        if data.get("yandex_api_key"):
            fields.append("yandex_api_key = %s"); params.append(data["yandex_api_key"])
        if data.get("yandex_folder_id"):
            fields.append("yandex_folder_id = %s"); params.append(data["yandex_folder_id"])
        if data.get("proxyapi_key"):
            fields.append("proxyapi_key = %s"); params.append(data["proxyapi_key"])
        if not fields:
            raise HTTPException(400, "No fields")
        fields.append("updated_at = NOW()")
        params.append(1)
        cur.execute(f"""
            UPDATE {SCHEMA}.ai_settings SET {', '.join(fields)} WHERE id = %s
            RETURNING selected_model, max_tokens, temperature, system_prompt, api_key,
                       gemini_api_key, yandex_api_key, yandex_folder_id, proxyapi_key, vision_provider
        """, params)
        row = cur.fetchone()
        gemini_key = row[5] or ""
        yandex_key = row[6] or os.environ.get("YANDEX_API_KEY", "")
        yandex_folder = row[7] or os.environ.get("YANDEX_FOLDER_ID", "")
        proxyapi_key = row[8] or ""
        vision_provider = row[9] or "proxyapi-gpt-4o"
        return {"settings": {
            "selected_model": row[0], "max_tokens": row[1], "temperature": float(row[2]),
            "system_prompt": row[3],
            "api_key_set": bool(row[4] or os.environ.get("DEEPSEEK_API_KEY")),
            "api_key_masked": mask_key(row[4] or os.environ.get("DEEPSEEK_API_KEY", "")),
            "gemini_key_set": bool(gemini_key),
            "gemini_key_masked": mask_key(gemini_key),
            "yandex_key_set": bool(yandex_key),
            "yandex_key_masked": mask_key(yandex_key),
            "yandex_folder_set": bool(yandex_folder),
            "yandex_folder_masked": mask_key(yandex_folder),
            "proxyapi_key_set": bool(proxyapi_key),
            "proxyapi_key_masked": mask_key(proxyapi_key),
            "vision_provider": vision_provider,
        }}


# ═══════════════════════════════════════════════════════════════════
#  AI Chat Endpoint
# ═══════════════════════════════════════════════════════════════════

@router.post("/api/ai-chat")
async def ai_chat(data: dict):
    messages = data.get("messages", [])
    requested_model = data.get("model")

    with get_cursor() as cur:
        settings = _get_ai_settings(cur)

    if not settings:
        raise HTTPException(500, "Настройки ИИ не найдены. Откройте раздел Настройки.")

    model = requested_model or settings["selected_model"]
    system_prompt = settings["system_prompt"] or DEFAULT_SYSTEM
    max_tokens = settings["max_tokens"]
    temperature = settings["temperature"]

    try:
        if model.startswith("deepseek"):
            if not settings["deepseek_key"]:
                raise HTTPException(400, "Ключ DeepSeek не задан.")
            reply = call_deepseek(model, messages, settings["deepseek_key"],
                                  system_prompt, max_tokens, temperature)
        elif model.startswith("gemini"):
            if not settings["gemini_key"]:
                raise HTTPException(400, "Ключ Gemini не задан.")
            reply = call_gemini(model, messages, settings["gemini_key"],
                                system_prompt, max_tokens, temperature)
        elif model.startswith("yandex"):
            if not settings["yandex_key"] or not settings["yandex_folder"]:
                raise HTTPException(400, "Не задан ключ или Folder ID Яндекс.")
            reply = call_yandexgpt(messages, settings["yandex_key"],
                                    settings["yandex_folder"],
                                    system_prompt, max_tokens, temperature)
        else:
            raise HTTPException(400, f"Модель {model} не поддерживается")
        return {"reply": reply, "model": model}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        raise HTTPException(e.code, {"error": f"API ошибка {e.code}", "detail": err_body[:500]})
    except Exception as e:
        raise HTTPException(500, str(e))