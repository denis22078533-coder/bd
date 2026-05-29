"""Эндпоинты для управления категориями."""
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from api.database.connection import get_cursor, SCHEMA

router = APIRouter(tags=["categories"])


@router.get("/api/categories")
async def categories_list():
    with get_cursor() as cur:
        cur.execute(
            f"SELECT name, is_default FROM {SCHEMA}.categories "
            f"ORDER BY is_default DESC, name ASC"
        )
        rows = [{"name": r[0], "is_default": r[1]} for r in cur.fetchall()]
        return {"categories": rows}


@router.post("/api/categories")
async def categories_create(data: dict):
    with get_cursor() as cur:
        name = (data.get("name") or "").strip()
        if not name:
            raise HTTPException(400, "name required")
        cur.execute(
            f"INSERT INTO {SCHEMA}.categories (name, is_default) "
            f"VALUES (%s, false) ON CONFLICT (name) DO NOTHING RETURNING name",
            (name,),
        )
        return {"ok": True, "name": name}


@router.delete("/api/categories")
async def categories_delete(name: str = Query(...)):
    with get_cursor() as cur:
        cur.execute(
            f"DELETE FROM {SCHEMA}.categories WHERE name = %s AND is_default = false",
            (name,),
        )
        return {"ok": True}