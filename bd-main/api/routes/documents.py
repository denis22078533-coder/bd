"""Эндпоинты для работы с документами."""
import traceback
from typing import Optional

from fastapi import APIRouter, Query, HTTPException
from psycopg2 import Error as PgError

from api.database.connection import get_cursor, SCHEMA

router = APIRouter(tags=["documents"])


@router.get("/api/documents")
async def documents_list():
    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT d.id, d.name, d.size_label, d.file_key, d.status,
                   d.rec_type, d.rec_amount, d.rec_date, d.rec_counterparty, d.rec_inn,
                   d.created_at, d.s3_url,
                   t.id AS transaction_id, t.category AS rec_category
            FROM {SCHEMA}.documents d
            LEFT JOIN {SCHEMA}.transactions t ON t.document_id = d.id AND t.status != 'Отменено'
            ORDER BY d.created_at DESC
            """
        )
        cols = [
            "id", "name", "size_label", "file_key", "status",
            "rec_type", "rec_amount", "rec_date",
            "rec_counterparty", "rec_inn", "created_at", "s3_url",
            "transaction_id", "rec_category",
        ]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        return {"documents": rows}


@router.post("/api/documents")
async def documents_create(data: dict):
    """Создание документа."""
    print(f"📝 Создание документа: {data.get('name', 'unnamed')}")

    with get_cursor() as cur:
        name = data.get("name", "Документ без названия")
        if not name or name.strip() == "":
            name = "Документ без названия"

        cur.execute(
            f"""
            INSERT INTO {SCHEMA}.documents
                (name, size_label, file_key, status, rec_type, rec_amount, rec_date,
                 rec_counterparty, rec_inn, rec_category, s3_url)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id, name, size_label, status, s3_url, created_at
            """,
            (
                name,
                data.get("size_label"),
                data.get("file_key"),
                data.get("status", "processing"),
                data.get("rec_type"),
                data.get("rec_amount"),
                data.get("rec_date"),
                data.get("rec_counterparty"),
                data.get("rec_inn"),
                data.get("rec_category", "Прочее"),
                data.get("s3_url"),
            ),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(500, "Не удалось создать документ")
        cols = ["id", "name", "size_label", "status", "s3_url", "created_at"]
        result = dict(zip(cols, row))
        print(f"   ✅ Документ создан: id={result['id']}")
        return {"document": result}


@router.put("/api/documents")
async def documents_update(id: int = Query(...), data: dict = {}):
    """Обновление документа."""
    print(f"📝 Обновление документа id={id}")

    with get_cursor() as cur:
        fields = []
        params = []
        mapping = {
            "status": "status", "rec_type": "rec_type", "rec_amount": "rec_amount",
            "rec_date": "rec_date", "rec_counterparty": "rec_counterparty",
            "rec_inn": "rec_inn", "rec_category": "rec_category", "name": "name",
        }
        for k, col in mapping.items():
            if k in data and data[k] is not None:
                fields.append(f"{col} = %s")
                params.append(data[k])

        if not fields:
            raise HTTPException(400, "Нет полей для обновления")

        params.append(id)
        cur.execute(
            f"""
            UPDATE {SCHEMA}.documents SET {', '.join(fields)}
            WHERE id = %s
            RETURNING id, name, size_label, status, rec_type, rec_amount,
                       rec_date, rec_counterparty, rec_inn, rec_category
            """,
            params,
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(404, "Документ не найден")
        cols = [
            "id", "name", "size_label", "status", "rec_type", "rec_amount",
            "rec_date", "rec_counterparty", "rec_inn", "rec_category",
        ]
        result = dict(zip(cols, row))
        print(f"   ✅ Документ обновлён: {result['name']}")
        return {"document": result}


@router.delete("/api/documents")
async def documents_delete(id: int = Query(...)):
    with get_cursor() as cur:
        cur.execute(
            f"SELECT id FROM {SCHEMA}.transactions WHERE document_id = %s",
            (id,),
        )
        tx_rows = [r[0] for r in cur.fetchall()]

        cur.execute(
            f"DELETE FROM {SCHEMA}.documents WHERE id = %s RETURNING id",
            (id,),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Not found")

        if tx_rows:
            cur.execute(
                f"DELETE FROM {SCHEMA}.transactions WHERE id = ANY(%s)",
                (tx_rows,),
            )
        return {"ok": True, "deleted_transactions": len(tx_rows)}