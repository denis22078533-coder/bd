"""Утилиты форматирования — сумма, дата, маскировка ключей."""
from datetime import date


def mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "●" * len(key)
    return key[:4] + "●" * (len(key) - 8) + key[-4:]


def fmt_rub(n) -> str:
    try:
        v = float(n)
        sign = "-" if v < 0 else ""
        return f"{sign}{abs(v):,.2f} ₽".replace(",", " ")
    except Exception:
        return str(n)


def fmt_date(d) -> str:
    try:
        if hasattr(d, "strftime"):
            return d.strftime("%d.%m.%Y")
        s = str(d)[:10]
        if "-" in s:
            p = s.split("-")
            return f"{p[2]}.{p[1]}.{p[0]}"
        return s
    except Exception:
        return str(d)