"""Хелперы для работы с Яндекс S3 (Object Storage)."""
import base64
import hashlib

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError, NoCredentialsError
from fastapi import HTTPException

from api.database.connection import SCHEMA

YANDEX_ENDPOINT = "https://storage.yandexcloud.net"


def get_s3_settings(cur):
    """Читает настройки S3 из БД."""
    cur.execute(
        f"SELECT bucket_name, endpoint_url, access_key, secret_key "
        f"FROM {SCHEMA}.s3_settings WHERE id=1"
    )
    row = cur.fetchone()
    if not row:
        return None
    configured = bool(row[0] and row[2] and row[3])
    return {
        "bucket": row[0],
        "endpoint": (row[1] or "").rstrip("/"),
        "access_key": row[2],
        "secret_key": row[3],
        "configured": configured,
    }


def upload_to_yandex(endpoint, bucket, key, data, content_type, access_key, secret_key):
    """Загружает файл в Яндекс Object Storage."""
    if not endpoint.startswith("http"):
        endpoint = "https://" + endpoint
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(
            connect_timeout=10,
            read_timeout=20,
            retries={"max_attempts": 1},
            s3={"addressing_style": "virtual"},
        ),
        region_name="ru-central1",
    )
    s3.put_object(Bucket=bucket, Key=key, Body=data, ContentType=content_type)
    return f"https://storage.yandexcloud.net/{bucket}/{key}"


def save_pdf(pdf_bytes: bytes, filename: str, yc=None) -> str:
    """Сохраняет PDF в S3 и возвращает URL."""
    key = f"reports/{filename}"
    if yc:
        s3 = boto3.client(
            "s3",
            endpoint_url=yc["endpoint"],
            aws_access_key_id=yc["access_key"],
            aws_secret_access_key=yc["secret_key"],
            config=Config(s3={"addressing_style": "virtual"}),
            region_name="ru-central1",
        )
        s3.put_object(
            Bucket=yc["bucket"],
            Key=key,
            Body=pdf_bytes,
            ContentType="application/pdf",
            ContentDisposition=f'attachment; filename="{filename}"',
        )
        return f"{yc['endpoint']}/{yc['bucket']}/{key}"
    else:
        raise HTTPException(
            status_code=500,
            detail="Яндекс S3 не настроен. Зайдите в ДВИЖОК → S3 и подключите Яндекс Object Storage.",
        )


def test_s3_connection(s3cfg) -> dict:
    """Тестирует подключение к S3."""
    if not s3cfg or not s3cfg[2] or not s3cfg[3] or not s3cfg[0]:
        return {
            "ok": False,
            "error": "Настройки Яндекс S3 не заполнены. "
                     "Укажите имя бакета, Access Key ID и Secret Key.",
        }
    try:
        endpoint = (s3cfg[1] or YANDEX_ENDPOINT).rstrip("/")
        if not endpoint.startswith("http"):
            endpoint = "https://" + endpoint
        client = boto3.client(
            "s3",
            endpoint_url=endpoint,
            aws_access_key_id=s3cfg[2],
            aws_secret_access_key=s3cfg[3],
            config=Config(
                connect_timeout=8,
                read_timeout=10,
                s3={"addressing_style": "virtual"},
            ),
            region_name="ru-central1",
        )
        client.list_objects_v2(Bucket=s3cfg[0], MaxKeys=1)
        return {"ok": True, "message": f"Подключение к бакету «{s3cfg[0]}» успешно!"}
    except ClientError as e:
        code = e.response["Error"]["Code"]
        msg = e.response["Error"].get("Message", str(e))
        return {"ok": False, "error": f"Ошибка {code}: {msg}"}
    except NoCredentialsError:
        return {"ok": False, "error": "Неверный Access Key ID или Secret Key"}
    except Exception as e:
        return {"ok": False, "error": str(e)}