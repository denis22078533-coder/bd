"""Выполнение SQL-миграций при старте приложения."""
import os
import glob

import psycopg2

from api.database.connection import SCHEMA


def run_migrations():
    """Выполняет SQL-миграции из папки db_migrations/ при старте."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        print("⚠️  DATABASE_URL не настроен, миграции пропущены")
        return

    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()

        # Создаём схему если нужно
        cur.execute(f"CREATE SCHEMA IF NOT EXISTS {SCHEMA}")

        # Находим все SQL-файлы миграций
        migrations_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
            "db_migrations",
        )
        if not os.path.exists(migrations_dir):
            print(f"⚠️  Папка миграций не найдена: {migrations_dir}")
            conn.close()
            return

        sql_files = sorted(glob.glob(os.path.join(migrations_dir, "V*.sql")))
        if not sql_files:
            print("⚠️  SQL-файлы миграций не найдены")
            conn.close()
            return

        print(f"🔄 Выполняем {len(sql_files)} миграций...")
        success_count = 0

        for filepath in sql_files:
            filename = os.path.basename(filepath)
            try:
                with open(filepath, "r", encoding="utf-8") as f:
                    sql_content = f.read()

                if not sql_content.strip():
                    continue

                # Заменяем схему
                sql_content = sql_content.replace(
                    "t_p79040548_accounting_automatio", SCHEMA
                )
                cur.execute(sql_content)
                success_count += 1
                print(f"   ✅ {filename}")
            except Exception as e:
                print(f"   ⚠️  {filename}: {e}")

        conn.commit()
        cur.close()
        conn.close()
        print(f"✅ Миграции выполнены: {success_count}/{len(sql_files)}")

    except Exception as e:
        print(f"❌ Ошибка миграций: {e}")


def init_db():
    """Создаёт таблицы, если их нет (не используется, заменено миграциями)."""
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        return
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        cur.execute(f"""
            CREATE SCHEMA IF NOT EXISTS {SCHEMA};
            CREATE TABLE IF NOT EXISTS {SCHEMA}.ai_settings (
                id SERIAL PRIMARY KEY,
                selected_model TEXT DEFAULT 'proxyapi-gpt-4o',
                max_tokens INT DEFAULT 4096,
                temperature REAL DEFAULT 0.3,
                system_prompt TEXT DEFAULT '',
                api_key TEXT DEFAULT '',
                gemini_api_key TEXT DEFAULT '',
                yandex_api_key TEXT DEFAULT '',
                yandex_folder_id TEXT DEFAULT '',
                proxyapi_key TEXT DEFAULT '',
                vision_provider TEXT DEFAULT 'proxyapi-gpt-4o',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS {SCHEMA}.s3_settings (
                id SERIAL PRIMARY KEY,
                bucket_name TEXT DEFAULT '',
                endpoint_url TEXT DEFAULT 'https://storage.yandexcloud.net',
                access_key TEXT DEFAULT '',
                secret_key TEXT DEFAULT '',
                use_yandex BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS {SCHEMA}.categories (
                id SERIAL PRIMARY KEY,
                name TEXT UNIQUE NOT NULL,
                is_default BOOLEAN DEFAULT false,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS {SCHEMA}.transactions (
                id SERIAL PRIMARY KEY,
                date DATE NOT NULL,
                description TEXT NOT NULL,
                category TEXT DEFAULT 'Прочее',
                amount NUMERIC(12,2) NOT NULL,
                status TEXT DEFAULT 'Выполнено',
                is_taxable BOOLEAN DEFAULT true,
                is_cashless BOOLEAN DEFAULT false,
                document_id INT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS {SCHEMA}.documents (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                size_label VARCHAR(32),
                file_key VARCHAR(512),
                file_hash VARCHAR(64),
                s3_url TEXT,
                status VARCHAR(32) DEFAULT 'processing',
                rec_type VARCHAR(128),
                rec_amount VARCHAR(64),
                rec_date VARCHAR(32),
                rec_counterparty VARCHAR(256),
                rec_inn VARCHAR(32),
                rec_category VARCHAR(128),
                transaction_id INTEGER,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS {SCHEMA}.document_pages (
                id SERIAL PRIMARY KEY,
                document_id INT NOT NULL,
                page_number INT NOT NULL,
                image_url TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            CREATE TABLE IF NOT EXISTS {SCHEMA}.tax_reports (
                id SERIAL PRIMARY KEY,
                year INT NOT NULL,
                quarter INT NOT NULL,
                total_income NUMERIC(12,2) DEFAULT 0,
                total_expense NUMERIC(12,2) DEFAULT 0,
                tax_amount NUMERIC(12,2) DEFAULT 0,
                status TEXT DEFAULT 'Черновик',
                created_at TIMESTAMP DEFAULT NOW(),
                updated_at TIMESTAMP DEFAULT NOW()
            );
            INSERT INTO {SCHEMA}.ai_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
            INSERT INTO {SCHEMA}.s3_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
            INSERT INTO {SCHEMA}.categories (name, is_default) VALUES
                ('Продукты', true), ('Транспорт', true), ('Связь', true),
                ('Коммунальные', true), ('Офис', true), ('Прочее', true)
            ON CONFLICT (name) DO NOTHING;
            COMMIT;
        """)
        cur.close()
        conn.close()
    except Exception:
        pass  # Если БД недоступна — не критично, таблицы создадутся позже