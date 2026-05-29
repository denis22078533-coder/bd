"""Подключение к БД с пулом соединений и контекстным менеджером."""
import os
from contextlib import contextmanager
from typing import Optional

import psycopg2
from psycopg2.pool import ThreadedConnectionPool
from fastapi import HTTPException

SCHEMA = os.environ.get("MAIN_DB_SCHEMA", "t_p79040548_accounting_automatio")

# Глобальный пул соединений (ленивая инициализация)
_pool: Optional[ThreadedConnectionPool] = None


def _init_pool() -> ThreadedConnectionPool:
    """Создаёт или возвращает существующий пул соединений."""
    global _pool
    if _pool is not None:
        return _pool

    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise HTTPException(
            status_code=500,
            detail="DATABASE_URL не настроен. Создайте базу данных в Vercel Postgres "
                   "и добавьте переменную окружения DATABASE_URL.",
        )

    _pool = ThreadedConnectionPool(
        minconn=1,
        maxconn=10,
        dsn=db_url,
    )
    return _pool


def _get_pool() -> ThreadedConnectionPool:
    """Получить пул (ленивая инициализация)."""
    global _pool
    if _pool is None:
        return _init_pool()
    return _pool


@contextmanager
def get_cursor():
    """Контекстный менеджер для получения курсора с автозакрытием.

    Usage:
        with get_cursor() as cur:
            cur.execute("SELECT ...")
            rows = cur.fetchall()
        # соединение автоматически возвращается в пул
    """
    pool = _get_pool()
    conn = None
    try:
        conn = pool.getconn()
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception:
        if conn:
            conn.rollback()
        raise
    finally:
        if cur:
            cur.close()
        if conn:
            pool.putconn(conn)


def get_conn():
    """Совместимость со старым кодом: получить сырое соединение."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise HTTPException(
            status_code=500,
            detail="DATABASE_URL не настроен. Создайте базу данных в Vercel Postgres "
                   "и добавьте переменную окружения DATABASE_URL.",
        )
    try:
        return psycopg2.connect(db_url)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Ошибка подключения к БД: {e}",
        )


def fetch_one(sql: str, params: tuple = ()) -> Optional[tuple]:
    """Выполнить SELECT и вернуть первую строку или None."""
    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchone()


def fetch_all(sql: str, params: tuple = ()) -> list:
    """Выполнить SELECT и вернуть все строки."""
    with get_cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def execute(sql: str, params: tuple = ()):
    """Выполнить INSERT/UPDATE/DELETE."""
    with get_cursor() as cur:
        cur.execute(sql, params)