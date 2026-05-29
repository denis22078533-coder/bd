"""Эндпоинты генерации PDF-отчётов."""
import io
import traceback
from datetime import datetime

from fastapi import APIRouter, HTTPException

from api.database.connection import get_cursor, SCHEMA
from api.utils.formatters import fmt_rub, fmt_date
from api.utils.s3_helpers import save_pdf

router = APIRouter(tags=["pdf"])


@router.post("/api/docs-pdf")
async def docs_pdf(data: dict):
    """Generate PDF from document data."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    doc_id = data.get("doc_id")

    with get_cursor() as cur:
        cur.execute(
            f"""
            SELECT d.id, d.name, d.rec_type, d.rec_amount, d.rec_date,
                   d.rec_counterparty, d.rec_inn, d.created_at, d.s3_url, d.file_key
            FROM {SCHEMA}.documents d WHERE d.id = %s
            """,
            (doc_id,),
        )
        doc = cur.fetchone()
        if not doc:
            raise HTTPException(404, "Document not found")

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4
        c.setFont("Helvetica-Bold", 16)
        c.drawString(30, height - 40, f"Документ №{doc[0]}")
        c.setFont("Helvetica", 10)
        y = height - 70
        c.drawString(30, y, f"Название: {doc[1] or '—'}")
        y -= 15
        c.drawString(30, y, f"Тип: {doc[2] or '—'}")
        y -= 15
        c.drawString(30, y, f"Сумма: {fmt_rub(doc[3]) if doc[3] else '—'}")
        y -= 15
        c.drawString(30, y, f"Дата: {fmt_date(doc[4]) if doc[4] else '—'}")
        y -= 15
        c.drawString(30, y, f"Контрагент: {doc[5] or '—'}")
        y -= 15
        c.drawString(30, y, f"ИНН: {doc[6] or '—'}")
        y -= 15
        c.drawString(30, y, f"Создан: {fmt_date(doc[7])}")
        y -= 30
        c.setFont("Helvetica-Bold", 12)
        c.drawString(30, y, "Транзакции:")
        y -= 15

        cur.execute(
            f"""
            SELECT id, date, description, category, amount, status
            FROM {SCHEMA}.transactions WHERE document_id = %s ORDER BY date DESC
            """,
            (doc_id,),
        )
        c.setFont("Helvetica", 9)
        for tx in cur.fetchall():
            line = (
                f"#{tx[0]} {fmt_date(tx[1])} | {tx[2][:50]} | "
                f"{tx[3]} | {fmt_rub(tx[4])} | {tx[5]}"
            )
            c.drawString(40, y, line)
            y -= 12
            if y < 40:
                c.showPage()
                y = height - 40
                c.setFont("Helvetica", 9)
        c.save()
        pdf_bytes = buf.getvalue()
        filename = f"document_{doc_id}.pdf"

        # Сохраняем в S3
        cur.execute(
            f"SELECT bucket_name, endpoint_url, access_key, secret_key "
            f"FROM {SCHEMA}.s3_settings WHERE id=1"
        )
        s3cfg_row = cur.fetchone()
        yc = None
        configured = s3cfg_row and s3cfg_row[0] and s3cfg_row[2] and s3cfg_row[3]
        if configured:
            yc = {
                "endpoint": (s3cfg_row[1] or "https://storage.yandexcloud.net").rstrip("/"),
                "bucket": s3cfg_row[0],
                "access_key": s3cfg_row[2],
                "secret_key": s3cfg_row[3],
            }
        pdf_url = save_pdf(pdf_bytes, filename, yc)
        return {
            "ok": True,
            "url": pdf_url,
            "filename": filename,
            "size": len(pdf_bytes),
        }


@router.post("/api/generate-pdf")
async def generate_pdf(data: dict):
    """Generate tax report PDF."""
    from reportlab.lib.pagesizes import A4
    from reportlab.pdfgen import canvas

    report_id = data.get("report_id")
    period = data.get("period", "")
    report_type = data.get("report_type", "Квартальный")

    with get_cursor() as cur:
        conditions = ["status != 'Отменено'"]
        params = []

        if period:
            if report_type == "Годовой":
                conditions.append("EXTRACT(YEAR FROM date) = %s")
                params.append(int(period))
            elif report_type == "Квартальный":
                parts = period.split("Q")
                if len(parts) == 2:
                    year = int(parts[0])
                    q = int(parts[1])
                    conditions.append(
                        "EXTRACT(YEAR FROM date) = %s AND EXTRACT(QUARTER FROM date) = %s"
                    )
                    params += [year, q]
            elif report_type == "Месячный":
                parts = period.split("-")
                if len(parts) == 2:
                    conditions.append(
                        "EXTRACT(YEAR FROM date) = %s AND EXTRACT(MONTH FROM date) = %s"
                    )
                    params += [int(parts[0]), int(parts[1])]

        where = "WHERE " + " AND ".join(conditions)

        cur.execute(
            f"""
            SELECT id, date, description, category, amount, status, is_cashless
            FROM {SCHEMA}.transactions {where} ORDER BY date DESC
            """,
            params,
        )
        transactions = cur.fetchall()

        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=A4)
        width, height = A4
        c.setFont("Helvetica-Bold", 18)
        c.drawString(30, height - 40, "Налоговый отчёт")
        c.setFont("Helvetica", 11)
        y = height - 65
        c.drawString(30, y, f"Период: {period} ({report_type})")
        y -= 15
        c.drawString(30, y, f"Создан: {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        y -= 15

        total_income = sum(t[4] for t in transactions if t[4] > 0)
        total_expense = sum(abs(t[4]) for t in transactions if t[4] < 0)

        c.drawString(30, y, f"Доходы: {fmt_rub(total_income)}")
        y -= 15
        c.drawString(30, y, f"Расходы: {fmt_rub(total_expense)}")
        y -= 15
        c.drawString(30, y, f"Налоговая база: {fmt_rub(total_income - total_expense)}")
        y -= 15
        vat = round(
            (total_income - total_expense) * 0.20 if total_income > total_expense else 0, 2
        )
        c.drawString(30, y, f"НДС (20%): {fmt_rub(vat)}")
        y -= 30
        c.setFont("Helvetica-Bold", 12)
        c.drawString(30, y, f"Операции ({len(transactions)}):")
        y -= 18
        c.setFont("Helvetica", 8)

        for t in transactions:
            line = (
                f"#{t[0]} {fmt_date(t[1])} | {t[2][:55]} | "
                f"{t[3]} | {fmt_rub(t[4])} | {t[5]}"
            )
            c.drawString(30, y, line)
            y -= 10
            if y < 30:
                c.showPage()
                y = height - 40
                c.setFont("Helvetica", 8)

        c.save()
        pdf_bytes = buf.getvalue()
        filename = (
            f"tax_report_{period.replace('Q', 'q')}_"
            f"{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        )

        # Сохраняем в S3
        cur.execute(
            f"SELECT bucket_name, endpoint_url, access_key, secret_key "
            f"FROM {SCHEMA}.s3_settings WHERE id=1"
        )
        s3cfg_row = cur.fetchone()
        yc = None
        configured = s3cfg_row and s3cfg_row[0] and s3cfg_row[2] and s3cfg_row[3]
        if configured:
            yc = {
                "endpoint": (s3cfg_row[1] or "https://storage.yandexcloud.net").rstrip("/"),
                "bucket": s3cfg_row[0],
                "access_key": s3cfg_row[2],
                "secret_key": s3cfg_row[3],
            }

        pdf_url = save_pdf(pdf_bytes, filename, yc)
        size_label = f"{len(pdf_bytes) / 1024:.0f} KB"

        cur.execute(
            f"""
            INSERT INTO {SCHEMA}.tax_reports
                (name, period, report_type, status, size_label)
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id, name, period, report_type, status, size_label, created_at
            """,
            (f"Отчёт {period}", period, report_type, "Готов", size_label),
        )
        cols = ["id", "name", "period", "report_type", "status", "size_label", "created_at"]
        report_row = dict(zip(cols, cur.fetchone()))

        return {
            "ok": True,
            "url": pdf_url,
            "filename": filename,
            "size": len(pdf_bytes),
            "report": report_row,
        }