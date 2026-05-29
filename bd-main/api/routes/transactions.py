"""Эндпоинты для работы с транзакциями."""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Query, HTTPException
from psycopg2 import Error as PgError

from api.database.connection import get_cursor, SCHEMA
from api.models.schemas import TransactionCreate, TransactionUpdate

router = APIRouter(tags=["transactions"])

TRANSACTION_COLS = [
    "id", "date", "description", "category", "amount",
    "status", "is_taxable", "is_cashless", "document_id", "created_at",
]


def _row_to_dict(row, cols=None) -> dict:
    """Преобразует кортеж БД в словарь."""
    c = cols or TRANSACTION_COLS
    result = dict(zip(c, row))
    if "amount" in result:
        result["amount"] = float(result["amount"])
    return result


@router.get("/api/transactions")
async def transactions_list(
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    date_from: Optional[str] = Query(None),
    date_to: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
):
    with get_cursor() as cur:
        if action == "summary":
            return _get_summary(cur, year)

        conditions = []
        params = []

        if search:
            conditions.append(
                "(description ILIKE %s OR CAST(id AS TEXT) ILIKE %s)"
            )
            params += [f"%{search}%", f"%{search}%"]
        if category and category != "Все":
            conditions.append("category = %s")
            params.append(category)
        if date_from:
            conditions.append("date >= %s")
            params.append(date_from)
        if date_to:
            conditions.append("date <= %s")
            params.append(date_to)

        where = ("WHERE " + " AND ".join(conditions)) if conditions else ""

        cur.execute(
            f"""
            SELECT {', '.join(TRANSACTION_COLS)}
            FROM {SCHEMA}.transactions {where}
            ORDER BY date DESC, id DESC LIMIT 200
            """,
            params,
        )
        rows = [_row_to_dict(r) for r in cur.fetchall()]
        return {"transactions": rows, "total": len(rows)}


def _get_summary(cur, year: Optional[int] = None) -> dict:
    """Формирует сводку для дашборда."""
    today = date.today()
    chart_year = year or today.year
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    cur.execute(
        f"""
        SELECT
            COALESCE(SUM(amount), 0) AS total_balance,
            COALESCE(SUM(CASE WHEN amount > 0 AND date >= %s THEN amount ELSE 0 END), 0) AS income_month,
            COALESCE(SUM(CASE WHEN amount < 0 AND date >= %s THEN ABS(amount) ELSE 0 END), 0) AS expense_month,
            COALESCE(SUM(CASE WHEN amount > 0 AND date >= %s THEN amount ELSE 0 END), 0) AS income_year,
            COALESCE(SUM(CASE WHEN amount < 0 AND date >= %s THEN ABS(amount) ELSE 0 END), 0) AS expense_year,
            COALESCE(SUM(CASE WHEN amount < 0 AND is_cashless = TRUE AND date >= %s THEN ABS(amount) ELSE 0 END), 0) AS cashless_month,
            COALESCE(SUM(CASE WHEN amount < 0 AND is_cashless = TRUE AND date >= %s THEN ABS(amount) ELSE 0 END), 0) AS cashless_year
        FROM {SCHEMA}.transactions
        WHERE status != 'Отменено'
        """,
        (month_start, month_start, year_start, year_start, month_start, year_start),
    )
    row = cur.fetchone()
    total_balance, income_month, expense_month, income_year, expense_year, cashless_month, cashless_year = row

    # Месячные данные для графика
    cur.execute(
        f"""
        SELECT EXTRACT(MONTH FROM date)::int AS m,
               COALESCE(SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END), 0) AS income,
               COALESCE(SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END), 0) AS expense
        FROM {SCHEMA}.transactions
        WHERE EXTRACT(YEAR FROM date) = %s AND status != 'Отменено'
        GROUP BY m ORDER BY m
        """,
        (chart_year,),
    )
    months_data = {
        r[0]: {"income": float(r[1]), "expense": float(r[2])}
        for r in cur.fetchall()
    }
    month_names = ["Янв","Фев","Мар","Апр","Май","Июн",
                   "Июл","Авг","Сен","Окт","Ноя","Дек"]
    chart = [
        {
            "month": month_names[i],
            "доход": months_data.get(i + 1, {}).get("income", 0),
            "расход": months_data.get(i + 1, {}).get("expense", 0),
        }
        for i in range(12)
    ]

    # Категории расходов
    cur.execute(
        f"""
        SELECT category, SUM(ABS(amount)) AS total
        FROM {SCHEMA}.transactions
        WHERE amount < 0 AND status != 'Отменено'
        GROUP BY category ORDER BY total DESC LIMIT 8
        """
    )
    categories = [{"name": r[0], "сумма": float(r[1])} for r in cur.fetchall()]

    return {
        "balance": float(total_balance),
        "income_month": float(income_month),
        "expense_month": float(expense_month),
        "income_year": float(income_year),
        "expense_year": float(expense_year),
        "profit_month": float(income_month) - float(expense_month),
        "cashless_month": float(cashless_month),
        "cashless_year": float(cashless_year),
        "chart": chart,
        "categories": categories,
    }


@router.post("/api/transactions")
async def transactions_create(data: TransactionCreate):
    with get_cursor() as cur:
        cur.execute(
            f"""
            INSERT INTO {SCHEMA}.transactions
                (date, description, category, amount, status, is_taxable, is_cashless, document_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING {', '.join(TRANSACTION_COLS)}
            """,
            (
                data.date or str(date.today()),
                data.description,
                data.category,
                data.amount,
                data.status,
                data.is_taxable,
                data.is_cashless,
                data.document_id,
            ),
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=400, detail="Не удалось создать транзакцию")
        return {"transaction": _row_to_dict(row)}


@router.put("/api/transactions")
async def transactions_update(id: int = Query(...), data: dict = {}):
    with get_cursor() as cur:
        fields = []
        params = []
        for f in ["date", "description", "category", "amount", "status",
                   "is_taxable", "is_cashless", "document_id"]:
            if f in data:
                fields.append(f"{f} = %s")
                params.append(data[f])
        if not fields:
            raise HTTPException(status_code=400, detail="No fields to update")
        params.append(id)
        cur.execute(
            f"""
            UPDATE {SCHEMA}.transactions
            SET {', '.join(fields)}, updated_at = NOW()
            WHERE id = %s
            RETURNING id, date, description, category, amount, status
            """,
            params,
        )
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Not found")
        cols = ["id", "date", "description", "category", "amount", "status"]
        result = dict(zip(cols, row))
        result["amount"] = float(result["amount"])
        return {"transaction": result}


@router.delete("/api/transactions")
async def transactions_delete(id: int = Query(...)):
    with get_cursor() as cur:
        cur.execute(
            f"DELETE FROM {SCHEMA}.transactions WHERE id = %s RETURNING id",
            (id,),
        )
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Not found")
        return {"ok": True}