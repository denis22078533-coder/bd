"""Pydantic-схемы для валидации входных/выходных данных."""
from __future__ import annotations

from datetime import date as Date, datetime
from typing import Optional, List, Any, Dict

from pydantic import BaseModel, Field


# ── Transactions ──────────────────────────────────────────

class TransactionCreate(BaseModel):
    date: str = Field(default_factory=lambda: str(Date.today()))
    description: str
    category: str = "Прочее"
    amount: float
    status: str = "Выполнено"
    is_taxable: bool = True
    is_cashless: bool = False
    document_id: Optional[int] = None


class TransactionUpdate(BaseModel):
    date: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = None
    status: Optional[str] = None
    is_taxable: Optional[bool] = None
    is_cashless: Optional[bool] = None
    document_id: Optional[int] = None


class TransactionOut(BaseModel):
    id: int
    date: Any
    description: str
    category: str
    amount: float
    status: str
    is_taxable: Optional[bool] = None
    is_cashless: Optional[bool] = None
    document_id: Optional[int] = None
    created_at: Optional[Any] = None


# ── Documents ─────────────────────────────────────────────

class DocumentCreate(BaseModel):
    name: str = "Документ без названия"
    size_label: Optional[str] = None
    file_key: Optional[str] = None
    status: str = "processing"
    rec_type: Optional[str] = None
    rec_amount: Optional[str] = None
    rec_date: Optional[str] = None
    rec_counterparty: Optional[str] = None
    rec_inn: Optional[str] = None
    rec_category: str = "Прочее"
    s3_url: Optional[str] = None


class DocumentUpdate(BaseModel):
    status: Optional[str] = None
    rec_type: Optional[str] = None
    rec_amount: Optional[str] = None
    rec_date: Optional[str] = None
    rec_counterparty: Optional[str] = None
    rec_inn: Optional[str] = None
    rec_category: Optional[str] = None
    name: Optional[str] = None


# ── Tax Reports ───────────────────────────────────────────

class TaxReportCreate(BaseModel):
    name: str = "Отчёт"
    period: str = ""
    report_type: str = "Квартальный"
    status: str = "Готов"
    size_label: str = "—"


# ── AI Settings ───────────────────────────────────────────

class AiSettingsUpdate(BaseModel):
    selected_model: Optional[str] = None
    max_tokens: Optional[int] = None
    temperature: Optional[float] = None
    system_prompt: Optional[str] = None
    vision_provider: Optional[str] = None
    api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    yandex_api_key: Optional[str] = None
    yandex_folder_id: Optional[str] = None
    proxyapi_key: Optional[str] = None


# ── S3 Settings ───────────────────────────────────────────

class S3SettingsUpdate(BaseModel):
    bucket_name: Optional[str] = None
    endpoint_url: Optional[str] = None
    access_key: Optional[str] = None
    secret_key: Optional[str] = None


# ── AI Chat ───────────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = None


# ── Upload ────────────────────────────────────────────────

class UploadDocRequest(BaseModel):
    file_b64: str
    file_name: str = "document"
    mime_type: str = "application/octet-stream"
    doc_id: Optional[int] = None


# ── Categories ────────────────────────────────────────────

class CategoryCreate(BaseModel):
    name: str


# ── Recognize ─────────────────────────────────────────────

class RecognizeRequest(BaseModel):
    ocr_text: str = ""
    image_b64: str = ""
    doc_id: Optional[int] = None
    auto_create_tx: bool = False


# ── PDF ───────────────────────────────────────────────────

class DocsPdfRequest(BaseModel):
    doc_id: Optional[int] = None


class GeneratePdfRequest(BaseModel):
    report_id: Optional[int] = None
    period: str = ""
    report_type: str = "Квартальный"