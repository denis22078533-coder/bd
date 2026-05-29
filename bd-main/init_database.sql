-- Инициализация базы данных для Бухгалтер мой / Бабки Скан
-- Запустить этот скрипт в Vercel Postgres SQL Editor

-- Создаём схему (если нужна отдельная схема)
-- CREATE SCHEMA IF NOT EXISTS t_p79040548_accounting_automatio;
-- Для Vercel Postgres используем схему public или указываем в MAIN_DB_SCHEMA

-- 1. Таблица операций (транзакций)
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    category VARCHAR(64) NOT NULL DEFAULT 'Прочее',
    amount NUMERIC(15, 2) NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'Выполнено',
    is_taxable BOOLEAN NOT NULL DEFAULT TRUE,
    is_cashless BOOLEAN NOT NULL DEFAULT FALSE,
    document_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Таблица документов (чеков, накладных)
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    size_label VARCHAR(32),
    file_key VARCHAR(512),
    file_hash VARCHAR(64),
    s3_url TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'processing',
    rec_type VARCHAR(128),
    rec_amount VARCHAR(64),
    rec_date VARCHAR(32),
    rec_counterparty VARCHAR(256),
    rec_inn VARCHAR(32),
    rec_category VARCHAR(128),
    transaction_id INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Таблица страниц документов (для многостраничных)
CREATE TABLE IF NOT EXISTS document_pages (
    id SERIAL PRIMARY KEY,
    document_id INTEGER NOT NULL,
    page_number INTEGER NOT NULL DEFAULT 1,
    s3_url TEXT NOT NULL,
    file_key VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_pages_doc_id ON document_pages(document_id, page_number);

-- 4. Таблица налоговых отчётов
CREATE TABLE IF NOT EXISTS tax_reports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    period VARCHAR(128) NOT NULL,
    report_type VARCHAR(64) NOT NULL DEFAULT 'Квартальный',
    status VARCHAR(32) NOT NULL DEFAULT 'Готов',
    size_label VARCHAR(32),
    file_key VARCHAR(512),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Таблица категорий расходов
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL UNIQUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Настройки ИИ
CREATE TABLE IF NOT EXISTS ai_settings (
    id INT PRIMARY KEY DEFAULT 1,
    selected_model VARCHAR(128) NOT NULL DEFAULT 'proxyapi-gpt-4o',
    max_tokens INT NOT NULL DEFAULT 4096,
    temperature NUMERIC(3,2) NOT NULL DEFAULT 0.30,
    system_prompt TEXT NOT NULL DEFAULT 'Ты финансовый ИИ-ассистент для B2B компании. Отвечай профессионально, кратко и по делу. Форматируй суммы в рублях.',
    api_key VARCHAR(512) DEFAULT '',
    gemini_api_key VARCHAR(512) DEFAULT '',
    yandex_api_key VARCHAR(512) DEFAULT '',
    yandex_folder_id VARCHAR(256) DEFAULT '',
    proxyapi_key VARCHAR(512) DEFAULT '',
    vision_provider VARCHAR(128) DEFAULT 'proxyapi-gpt-4o',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ai_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 7. Настройки S3 (Яндекс Object Storage)
CREATE TABLE IF NOT EXISTS s3_settings (
    id INT PRIMARY KEY DEFAULT 1,
    bucket_name VARCHAR(255) NOT NULL DEFAULT '',
    endpoint_url VARCHAR(512) NOT NULL DEFAULT 'https://storage.yandexcloud.net',
    access_key VARCHAR(512) NOT NULL DEFAULT '',
    secret_key VARCHAR(512) NOT NULL DEFAULT '',
    use_yandex BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO s3_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- Стандартные категории
INSERT INTO categories (name, is_default) VALUES
    ('Прочее', TRUE),
    ('Товары для перепродажи', TRUE),
    ('Материалы', TRUE),
    ('Услуги', TRUE),
    ('Аренда', TRUE),
    ('Коммунальные услуги', TRUE),
    ('Транспорт', TRUE),
    ('Зарплата', TRUE),
    ('Налоги', TRUE),
    ('Реклама', TRUE),
    ('Хозтовары', TRUE),
    ('ГСМ', TRUE)
ON CONFLICT DO NOTHING;

-- Проверка
SELECT 'Таблицы созданы успешно!' as status;
