# СканУчёт БДА Групп — Автоматизация бухгалтерского учёта

СканУчёт БДА Групп — программа бухгалтерского учёта с ИИ-распознаванием документов, автоматическим расчётом налогов и формированием отчётов.

## Технологии

- **Frontend:** React + TypeScript + Tailwind CSS + Vite
- **Backend:** FastAPI (Python) на Vercel Serverless
- **База данных:** PostgreSQL (автономная)
- **Файловое хранилище:** Яндекс Object Storage (S3)
- **ИИ:** DeepSeek, Gemini, Yandex OCR, ProxyAPI

## Локальный запуск

```bash
npm install
npm run dev
```

## Переменные окружения

- `DATABASE_URL` — подключение к PostgreSQL
- `MAIN_DB_SCHEMA` — схема БД

## Деплой

Автоматический деплой на Vercel при push в main.
