"""Эндпоинты для настроек S3 (Яндекс Object Storage)."""
from typing import Optional

from fastapi import APIRouter, Query

from api.database.connection import get_cursor, SCHEMA
from api.utils.formatters import mask_key
from api.utils.s3_helpers import YANDEX_ENDPOINT, test_s3_connection

router = APIRouter(tags=["s3_settings"])


@router.get("/api/s3-settings")
async def s3_settings_get(action: Optional[str] = Query(None)):
    with get_cursor() as cur:
        if action == "test":
            cur.execute(f"SELECT bucket_name, endpoint_url, access_key, secret_key FROM {SCHEMA}.s3_settings WHERE id=1")
            s3cfg = cur.fetchone()
            return test_s3_connection(s3cfg)
        cur.execute(f"SELECT bucket_name, endpoint_url, access_key, secret_key FROM {SCHEMA}.s3_settings WHERE id=1")
        s = cur.fetchone()
        if not s:
            return {"settings": {"bucket_name": "", "endpoint_url": YANDEX_ENDPOINT, "access_key": "", "secret_key_masked": "", "configured": False}}
        configured = bool(s[2] and s[3] and s[0])
        return {"settings": {"bucket_name": s[0], "endpoint_url": s[1] or YANDEX_ENDPOINT, "access_key": s[2], "secret_key_masked": mask_key(s[3]), "configured": configured}}


@router.put("/api/s3-settings")
async def s3_settings_update(data: dict):
    with get_cursor() as cur:
        cur.execute(f"SELECT bucket_name, endpoint_url, access_key, secret_key FROM {SCHEMA}.s3_settings WHERE id=1")
        s = cur.fetchone()
        bucket = data.get("bucket_name", s[0] if s else "")
        endpoint = data.get("endpoint_url", s[1] if s else YANDEX_ENDPOINT) or YANDEX_ENDPOINT
        access = data.get("access_key", s[2] if s else "")
        secret = data.get("secret_key") or (s[3] if s else "")
        if s:
            cur.execute(f"UPDATE {SCHEMA}.s3_settings SET bucket_name=%s, endpoint_url=%s, access_key=%s, secret_key=%s, updated_at=NOW() WHERE id=1", (bucket, endpoint, access, secret))
        else:
            cur.execute(f"INSERT INTO {SCHEMA}.s3_settings (id, bucket_name, endpoint_url, access_key, secret_key) VALUES (1, %s, %s, %s, %s)", (bucket, endpoint, access, secret))
        configured = bool(bucket and access and secret)
        return {"ok": True, "settings": {"bucket_name": bucket, "endpoint_url": endpoint, "access_key": access, "secret_key_masked": mask_key(secret), "configured": configured}}


@router.post("/api/fix-s3-acl")
async def fix_s3_acl():
    """Исправление ACL для документов в S3 (заглушка)."""
    return {"ok": True, "fixed": 0, "errors_count": 0, "errors": []}