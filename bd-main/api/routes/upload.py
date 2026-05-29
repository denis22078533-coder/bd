"""Эндпоинты загрузки: upload-doc, img-proxy, sync-old-docs."""
import base64
import hashlib
from datetime import datetime
from typing import Optional

import boto3
import requests
from botocore.config import Config
from fastapi import APIRouter, Query, HTTPException, Response

from api.database.connection import get_cursor, SCHEMA
from api.utils.s3_helpers import get_s3_settings, upload_to_yandex

router = APIRouter(tags=["upload"])

ALLOWED_HOSTS = ["storage.yandexcloud.net"]


@router.post("/api/upload-doc")
async def upload_doc(data: dict):
    """Загружает документ в S3."""
    file_b64 = data.get("file_b64", "")
    file_name = data.get("file_name", "document")
    mime_type = data.get("mime_type", "application/octet-stream")
    doc_id = data.get("doc_id")

    if not file_b64:
        raise HTTPException(400, "file_b64 required")

    try:
        file_bytes = base64.b64decode(file_b64)
    except Exception as e:
        raise HTTPException(400, f"bad base64: {e}")

    file_hash = hashlib.md5(file_bytes).hexdigest()

    with get_cursor() as cur:
        # Проверка дубликата
        cur.execute(
            f"SELECT id, name, created_at FROM {SCHEMA}.documents "
            f"WHERE file_hash=%s LIMIT 1",
            (file_hash,),
        )
        dup = cur.fetchone()
        if dup:
            return {
                "duplicate": True,
                "existing_id": dup[0],
                "existing_name": dup[1],
                "existing_date": str(dup[2]),
                "message": f"Файл уже загружен: «{dup[1]}»",
            }

        s3cfg = get_s3_settings(cur)
        now = datetime.now()
        folder = f"documents/{now.year}/{now.month:02d}"
        safe_name = (file_name or "document").replace(" ", "_").replace("/", "_")
        key = f"{folder}/{now.strftime('%H%M%S')}_{safe_name}"

        if s3cfg and s3cfg["configured"]:
            try:
                file_url = upload_to_yandex(
                    s3cfg["endpoint"] or "https://storage.yandexcloud.net",
                    s3cfg["bucket"],
                    key,
                    file_bytes,
                    mime_type,
                    s3cfg["access_key"],
                    s3cfg["secret_key"],
                )
            except Exception as e:
                raise HTTPException(
                    500,
                    f"Ошибка загрузки в Яндекс S3: {e}. "
                    f"Проверьте ключи в ДВИЖОК → S3.",
                )
        else:
            raise HTTPException(
                500,
                "Яндекс S3 не настроен. Зайдите в ДВИЖОК → S3 "
                "и подключите Яндекс Object Storage.",
            )

        # Привязываем URL к документу
        if doc_id:
            try:
                cur.execute(
                    f"UPDATE {SCHEMA}.documents "
                    f"SET s3_url=%s, file_key=%s, file_hash=%s WHERE id=%s",
                    (file_url, key, file_hash, doc_id),
                )
            except Exception:
                pass

        return {"ok": True, "url": file_url, "key": key}


@router.get("/api/img-proxy")
async def img_proxy(url: str = Query(...)):
    """Прокси для изображений из S3."""
    allowed = any(host in url for host in ALLOWED_HOSTS)
    if not allowed:
        raise HTTPException(403, "forbidden host")
    try:
        r = requests.get(url, timeout=15, headers={"User-Agent": "Mozilla/5.0"})
        if r.status_code != 200:
            raise HTTPException(r.status_code, f"upstream {r.status_code}")
        content_type = r.headers.get("Content-Type", "image/jpeg")
        img_b64 = base64.b64encode(r.content).decode("utf-8")
        return Response(
            content=base64.b64decode(img_b64),
            media_type=content_type,
            headers={"Cache-Control": "public, max-age=86400"},
        )
    except requests.RequestException as e:
        raise HTTPException(502, str(e))


@router.post("/api/sync-old-docs")
async def sync_old_docs():
    """Сканирует бакет S3 и создаёт записи в БД для существующих файлов."""
    with get_cursor() as cur:
        cur.execute(
            f"SELECT bucket_name, endpoint_url, access_key, secret_key "
            f"FROM {SCHEMA}.s3_settings WHERE id=1"
        )
        s3cfg = cur.fetchone()
        if not s3cfg or not s3cfg[0] or not s3cfg[2]:
            raise HTTPException(
                400, "S3 не настроен. Настройте бакет в разделе ДВИЖОК → S3"
            )

        bucket = s3cfg[0]
        endpoint = (s3cfg[1] or "https://storage.yandexcloud.net").rstrip("/")
        access_key = s3cfg[2]
        secret_key = s3cfg[3]

        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=Config(
                connect_timeout=10,
                read_timeout=20,
                s3={"addressing_style": "virtual"},
            ),
            region_name="ru-central1",
        )

        print(f"🔄 Сканируем бакет: {bucket}")
        paginator = s3.get_paginator("list_objects_v2")
        all_objects = []
        for page in paginator.paginate(Bucket=bucket):
            if "Contents" in page:
                all_objects.extend(page["Contents"])
        print(f"📁 Найдено {len(all_objects)} объектов в бакете")

        cur.execute(
            f"SELECT file_key FROM {SCHEMA}.documents WHERE file_key IS NOT NULL"
        )
        existing_keys = {row[0] for row in cur.fetchall()}
        print(f"📋 Уже в БД: {len(existing_keys)} документов")

        new_files = []
        for obj in all_objects:
            key = obj["Key"]
            if key in existing_keys:
                continue
            if key.startswith("_") or "/_" in key:
                continue
            if any(
                key.lower().endswith(ext)
                for ext in [".jpg", ".jpeg", ".png", ".pdf", ".tiff", ".bmp"]
            ):
                new_files.append(obj)
        print(f"🆕 Новых файлов для добавления: {len(new_files)}")

        added_count = 0
        for obj in new_files:
            key = obj["Key"]
            size = obj["Size"]
            last_modified = obj["LastModified"]
            file_url = f"{endpoint}/{bucket}/{key}"

            if size < 1024:
                size_label = f"{size} B"
            elif size < 1024 * 1024:
                size_label = f"{size / 1024:.1f} KB"
            else:
                size_label = f"{size / (1024 * 1024):.1f} MB"

            name = key.split("/")[-1] if "/" in key else key

            try:
                cur.execute(
                    f"""
                    INSERT INTO {SCHEMA}.documents
                    (name, size_label, file_key, s3_url, status, created_at)
                    VALUES (%s, %s, %s, %s, 'pending', %s)
                    ON CONFLICT DO NOTHING
                    RETURNING id
                    """,
                    (name, size_label, key, file_url, last_modified),
                )
                if cur.fetchone():
                    added_count += 1
            except Exception as e:
                print(f"⚠️ Ошибка добавления {key}: {e}")
                continue

        return {
            "ok": True,
            "total_in_bucket": len(all_objects),
            "already_in_db": len(existing_keys),
            "new_files_found": len(new_files),
            "added_to_db": added_count,
            "message": f"Синхронизация завершена. Добавлено {added_count} новых документов.",
        }