"""
Единый бэкенд для СканУчёт БДА Групп.
FastAPI + Vercel Serverless.

Точка входа — подключает модульные роутеры.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.middleware.error_handler import global_exception_handler
from api.database.migrations import run_migrations
from api.routes.transactions import router as transactions_router
from api.routes.documents import router as documents_router
from api.routes.tax_reports import router as tax_reports_router
from api.routes.ai import router as ai_router
from api.routes.s3 import router as s3_router
from api.routes.categories import router as categories_router
from api.routes.upload import router as upload_router
from api.routes.pdf import router as pdf_router  # type: ignore

app = FastAPI(title="СканУчёт БДА Групп API")


@app.on_event("startup")
async def startup_event():
    """Запускается при старте приложения."""
    print("🚀 Запуск приложения...")
    run_migrations()
    print("✅ Приложение готово к работе!")


# CORS — origins из переменной окружения, fallback на "*" для разработки
_cors_origins_raw = os.environ.get("CORS_ORIGINS", "*")
_cors_origins = (
    [o.strip() for o in _cors_origins_raw.split(",")]
    if _cors_origins_raw != "*"
    else ["*"]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Глобальный обработчик ошибок
app.add_exception_handler(Exception, global_exception_handler)

# Подключаем все роутеры
app.include_router(transactions_router)
app.include_router(documents_router)
app.include_router(tax_reports_router)
app.include_router(ai_router)
app.include_router(s3_router)
app.include_router(categories_router)
app.include_router(upload_router)
app.include_router(pdf_router)


@app.get("/api/health")
async def health():
    return {"ok": True, "status": "alive", "version": "3.0"}