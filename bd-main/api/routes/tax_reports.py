"""Эндпоинты для налоговой отчётности."""
from typing import Optional

from fastapi import APIRouter, Query, HTTPException

from api.database.connection import get_cursor, SCHEMA

router = APIRouter(tags=["tax_reports"])


@router.get("/api/tax-reports")
async def tax_reports_list(
    action: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
):
    with get_cursor() as cur:
        if action == "summary":
            conditions = ["status != 'Отменено'"]
            params = []
            if date_from:
                conditions.append("date >= %s")
                params.append(date_from)
            if date_to:
                conditions.append("date <= %s")
                params.append(date_to)
            where = "WHERE " + " AND ".join(conditions)
            cur.execute(
                f"""
                SELECT
                    COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
                    COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS expense
                FROM {SCHEMA}.transactions {where}
                """,
                params,
            )
            income, expense = cur.fetchone()
            income = float(income)
            expense = float(expense)
            base = income - expense
            vat = round(base * 0.20 if base > 0 else 0, 2)
            return {"income": income, "expense": expense, "tax_base": base, "vat": vat}

        cur.execute(
            f"""
            SELECT id, name, period, report_type, status, size_label, created_at
            FROM {SCHEMA}.tax_reports ORDER BY created_at DESC
            """
        )
        cols = ["id", "name", "period", "report_type", "status", "size_label", "created_at"]
        rows = [dict(zip(cols, r)) for r in cur.fetchall()]
        return {"reports": rows}


@router.post("/api/tax-reports")
async def tax_reports_create(data: dict):
    with get_cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO {SCHEMA}.tax_reports (name, period, report_type, status, size_label)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name, period, report_type, status, size_label, created_at
            """,
            (
                data.get("name", "Отчёт"),
                data.get("period", ""),
                data.get("report_type", "Квартальный"),
                data.get("status", "Готов"),
                data.get("size_label", "—"),
            ),
        )
        cols = ["id", "name", "period", "report_type", "status", "size_label", "created_at"]
        row = dict(zip(cols, cur.fetchone()))
        return {"report": row}


@router.delete("/api/tax-reports")
async def tax_reports_delete(id: int = Query(...)):
    with get_cursor() as cur:
        cur.execute(
            f"DELETE FROM {SCHEMA}.tax_reports WHERE id = %s RETURNING id",
            (id,),
        )
        if not cur.fetchone():
            raise HTTPException(404, "Not found")
        return {"ok": True}