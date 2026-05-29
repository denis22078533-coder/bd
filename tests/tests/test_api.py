"""
Smoke-тесты для API (проверка импортов и утилит).
"""
import os
import sys
import pytest


def test_imports():
    """Все модули должны импортироваться без ошибок."""
    modules = [
        "api.utils.formatters",
        "api.utils.s3_helpers",
        "api.database.connection",
        "api.database.migrations",
        "api.middleware.error_handler",
        "api.models.schemas",
        "api.routes.transactions",
        "api.routes.documents",
        "api.routes.tax_reports",
        "api.routes.categories",
        "api.routes.s3",
        "api.routes.ai",
        "api.routes.upload",
        "api.routes.pdf",
    ]
    for module_name in modules:
        __import__(module_name)


def test_formatters():
    """Проверка утилит форматирования."""
    from api.utils.formatters import mask_key, fmt_rub, fmt_date

    assert mask_key("") == ""
    assert mask_key("1234") == "●●●●"
    assert mask_key("sk-1234567890abcdef") == "sk-1●●●●●●f"

    assert "1,000.00 ₽" in fmt_rub(1000)
    assert "-500.00 ₽" in fmt_rub(-500)

    assert fmt_date("2024-03-15") == "15.03.2024"


def test_error_handler_structure():
    """Глобальный обработчик ошибок должен быть корутиной."""
    import inspect
    from api.middleware.error_handler import global_exception_handler
    assert inspect.iscoroutinefunction(global_exception_handler)