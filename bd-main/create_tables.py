#!/usr/bin/env python3
"""
Скрипт для создания таблиц в базе данных Neon/Vercel Postgres.
Читает SQL-файлы из папки db_migrations/ и выполняет их.
"""

# ═══════════════════════════════════════════════════════════════════
# АВТОМАТИЧЕСКАЯ УСТАНОВКА БИБЛИОТЕКИ (строки 1-10)
# ═══════════════════════════════════════════════════════════════════
import subprocess
import sys

try:
    import psycopg2
except ImportError:
    print("🔄 Библиотека psycopg2 не найдена. Устанавливаем...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "psycopg2-binary"])
    print("✅ Библиотека установлена! Перезапускаем...")
    import psycopg2
    print("✅ psycopg2 загружен успешно!")

# ═══════════════════════════════════════════════════════════════════
# ОСНОВНОЙ КОД СКРИПТА
# ═══════════════════════════════════════════════════════════════════
import os
import glob
from urllib.parse import urlparse

# ГОТОВАЯ СТРОКА ПОДКЛЮЧЕНИЯ (уже вставлена)
DATABASE_URL = "postgresql://neondb_owner:npg_hyrW0CvUaS4u@ep-spring-hat-alx21ngz-pooler.c-3.eu-central-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require"

# Схема базы данных (public для Neon/Vercel Postgres)
SCHEMA = "public"


def parse_db_url(url):
    """Парсит DATABASE_URL и возвращает параметры подключения."""
    parsed = urlparse(url)
    return {
        "host": parsed.hostname,
        "port": parsed.port or 5432,
        "database": parsed.path[1:],  # убираем ведущий /
        "user": parsed.username,
        "password": parsed.password,
    }


def get_connection():
    """Подключается к базе данных."""
    try:
        params = parse_db_url(DATABASE_URL)
        print(f"🔄 Подключаемся к БД: {params['host']}")
        
        conn = psycopg2.connect(
            host=params["host"],
            port=params["port"],
            database=params["database"],
            user=params["user"],
            password=params["password"],
            sslmode="require"
        )
        print("✅ Подключение успешно!")
        return conn
    except Exception as e:
        print(f"❌ Ошибка подключения: {e}")
        sys.exit(1)


def read_sql_files():
    """Читает все SQL-файлы из папки db_migrations/."""
    migrations_dir = os.path.join(os.path.dirname(__file__), "db_migrations")
    
    if not os.path.exists(migrations_dir):
        print(f"❌ Папка {migrations_dir} не найдена!")
        return []
    
    # Находим все .sql файлы и сортируем по имени (V0001, V0002, ...)
    sql_files = sorted(glob.glob(os.path.join(migrations_dir, "V*.sql")))
    
    if not sql_files:
        print("❌ SQL-файлы не найдены в папке db_migrations/")
        return []
    
    print(f"📁 Найдено {len(sql_files)} SQL-файлов миграций")
    for f in sql_files:
        print(f"   - {os.path.basename(f)}")
    
    return sql_files


def execute_sql_file(cursor, filepath):
    """Выполняет один SQL-файл."""
    filename = os.path.basename(filepath)
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            sql_content = f.read()
        
        # Пропускаем пустые файлы
        if not sql_content.strip():
            print(f"   ⏭️  {filename} (пустой)")
            return True
        
        # Заменяем схему в SQL-запросах
        sql_content = sql_content.replace("t_p79040548_accounting_automatio", SCHEMA)
        
        # Выполняем SQL
        cursor.execute(sql_content)
        print(f"   ✅ {filename}")
        return True
        
    except Exception as e:
        print(f"   ⚠️  Ошибка в {filename}: {e}")
        return False


def create_tables():
    """Основная функция создания таблиц."""
    print("=" * 60)
    print("🚀 Создание таблиц в базе данных Neon")
    print("=" * 60)
    
    # Подключаемся к БД
    conn = get_connection()
    cursor = conn.cursor()
    
    # Читаем SQL-файлы
    sql_files = read_sql_files()
    
    if not sql_files:
        print("\n❌ Нет файлов для выполнения")
        cursor.close()
        conn.close()
        sys.exit(1)
    
    # Выполняем каждый файл
    print(f"\n📝 Выполняем миграции...")
    success_count = 0
    for filepath in sql_files:
        if execute_sql_file(cursor, filepath):
            success_count += 1
    
    # Фиксируем изменения
    conn.commit()
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 60)
    print(f"✅ Готово! Выполнено: {success_count}/{len(sql_files)} миграций")
    print("=" * 60)
    print(f"\nТеперь можешь запустить сайт:")
    print("  npm run dev")


if __name__ == "__main__":
    create_tables()
