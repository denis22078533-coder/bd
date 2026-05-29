"""Глобальный обработчик ошибок."""
import json
import traceback

from fastapi import HTTPException
from fastapi.responses import Response


async def global_exception_handler(request, exc):
    """Перехватывает все необработанные исключения и возвращает JSON."""
    if isinstance(exc, HTTPException):
        return Response(
            content=json.dumps({"error": exc.detail}),
            status_code=exc.status_code,
            media_type="application/json",
        )
    tb = traceback.format_exc()
    return Response(
        content=json.dumps({"error": str(exc), "traceback": tb}),
        status_code=500,
        media_type="application/json",
    )