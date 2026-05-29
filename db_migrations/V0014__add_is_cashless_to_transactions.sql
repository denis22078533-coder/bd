-- Добавляем колонку is_cashless (безналичный расчёт) в таблицу transactions
ALTER TABLE t_p79040548_accounting_automatio.transactions
  ADD COLUMN IF NOT EXISTS is_cashless boolean NOT NULL DEFAULT false;
