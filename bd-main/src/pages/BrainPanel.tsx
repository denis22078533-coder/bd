import { useState, useEffect } from "react";
import { getAllUsers, deleteUser, addTokens, addAdminHelper, removeAdminHelper, getAdminHelpers, resetSuperAdminPassword, ADMIN_EMAIL } from "@/lib/auth";
import EngineSettings from "@/pages/EngineSettings";
import Icon from "@/components/ui/icon";

type BrainTab =
  | "engine"
  | "github"
  | "payments"
  | "system"
  | "logs"
  | "users"
  | "dialogs"
  | "integrations"
  | "remote";

const tabs: { id: BrainTab; label: string }[] = [
  { id: "engine", label: "ДВИЖОК" },
  { id: "github", label: "GITHUB" },
  { id: "payments", label: "ПЛАТЕЖИ" },
  { id: "system", label: "СИСТЕМА" },
  { id: "logs", label: "ЛОГИ" },
  { id: "users", label: "ПОЛЬЗОВАТЕЛИ" },
  { id: "dialogs", label: "ДИАЛОГИ" },
  { id: "integrations", label: "ИНТЕГРАЦИИ" },
  { id: "remote", label: "УДАЛЁННЫЙ СЕРВЕР" },
];

const tabLabels: Record<BrainTab, string> = {
  engine: "Движок",
  github: "GitHub",
  payments: "Платежи",
  system: "Система",
  logs: "Логи",
  users: "Пользователи",
  dialogs: "Диалоги",
  integrations: "Интеграции",
  remote: "Удалённый сервер",
};

// ─── Типы для T‑Bank ────────────────────────────────────────
interface TbankConfig {
  terminalKey: string;
  secretPassword: string;
  sandbox: boolean;
}

const TBANK_STORAGE_KEY = "tbank_config";

function loadTbankConfig(): TbankConfig {
  try {
    const raw = localStorage.getItem(TBANK_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { terminalKey: "", secretPassword: "", sandbox: true };
}

function saveTbankConfig(config: TbankConfig) {
  localStorage.setItem(TBANK_STORAGE_KEY, JSON.stringify(config));
}

// ─── Типы для СБП ───────────────────────────────────────────
interface SbpConfig {
  merchantId: string;
}

const SBP_STORAGE_KEY = "sbp_config";

function loadSbpConfig(): SbpConfig {
  try {
    const raw = localStorage.getItem(SBP_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { merchantId: "" };
}

function saveSbpConfig(config: SbpConfig) {
  localStorage.setItem(SBP_STORAGE_KEY, JSON.stringify(config));
}

// ─── Тарифы ─────────────────────────────────────────────────
const tariffs = [
  {
    name: "Старт",
    price: "990 ₽ / мес",
    tokens: 100,
    docs: "до 50 документов",
    features: ["Базовый ИИ-ассистент", "Распознавание чеков", "Налоговый отчёт"],
    recommended: false,
  },
  {
    name: "Бизнес",
    price: "2 490 ₽ / мес",
    tokens: 300,
    docs: "до 200 документов",
    features: ["Продвинутый ИИ-ассистент", "Распознавание любых документов", "Налоговый отчёт + аналитика", "Приоритетная поддержка"],
    recommended: true,
  },
  {
    name: "Профи",
    price: "5 990 ₽ / мес",
    tokens: 1000,
    docs: "безлимит",
    features: ["Полный ИИ-ассистент", "Распознавание + Excel", "Налоговый отчёт + аналитика", "Выделенный менеджер", "API-доступ"],
    recommended: false,
  },
];

// ═══════════════════════════════════════════════════════════════
//  Компонент вкладки ПЛАТЕЖИ
// ═══════════════════════════════════════════════════════════════
function PaymentsTab() {
  // T‑Bank
  const [tbank, setTbank] = useState<TbankConfig>(loadTbankConfig);
  const [tbankSaved, setTbankSaved] = useState(false);

  // СБП
  const [sbp, setSbp] = useState<SbpConfig>(loadSbpConfig);
  const [sbpSaved, setSbpSaved] = useState(false);

  // Ручное начисление токенов
  const [manualEmail, setManualEmail] = useState("");
  const [manualTokens, setManualTokens] = useState("");
  const [manualResult, setManualResult] = useState<{ ok: boolean; message: string } | null>(null);

  // ── Сохранение T‑Bank ──────────────────────────────────────
  const handleSaveTbank = () => {
    saveTbankConfig(tbank);
    setTbankSaved(true);
    setTimeout(() => setTbankSaved(false), 3000);
  };

  // ── Сохранение СБП ─────────────────────────────────────────
  const handleSaveSbp = () => {
    saveSbpConfig(sbp);
    setSbpSaved(true);
    setTimeout(() => setSbpSaved(false), 3000);
  };

  // ── Ручное начисление токенов ──────────────────────────────
  const handleManualTokens = () => {
    if (!manualEmail.trim() || !manualTokens.trim()) {
      setManualResult({ ok: false, message: "Заполните оба поля" });
      return;
    }
    const count = parseInt(manualTokens, 10);
    if (isNaN(count) || count <= 0) {
      setManualResult({ ok: false, message: "Количество токенов должно быть положительным числом" });
      return;
    }
    // Пока сохраняем в localStorage как историю начислений
    const historyKey = "token_manual_history";
    const history: { email: string; tokens: number; date: string }[] = [];
    try {
      const raw = localStorage.getItem(historyKey);
      if (raw) history.push(...JSON.parse(raw));
    } catch { /* ignore */ }
    history.push({ email: manualEmail.trim(), tokens: count, date: new Date().toISOString() });
    localStorage.setItem(historyKey, JSON.stringify(history));

    setManualResult({ ok: true, message: `Начислено ${count} токенов пользователю ${manualEmail.trim()}` });
    setManualEmail("");
    setManualTokens("");
    setTimeout(() => setManualResult(null), 5000);
  };

  return (
    <div className="space-y-5">
      {/* ═══════════════════════════════════════════════════════
           БЛОК 1: ИНТЕГРАЦИЯ Т-БАНК (ЭКВАЙРИНГ)
           ═══════════════════════════════════════════════════════ */}
      <div className="card-fin p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-900/20 border border-green-700/30 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Интеграция Т-Банк (Эквайринг)</div>
            <div className="text-xs text-muted-foreground">Приём платежей через Т-Банк (Тинькофф)</div>
          </div>
        </div>

        <div className="space-y-3">
          {/* Ключ терминала */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Ключ терминала (Terminal Key)</label>
            <input
              type="text"
              value={tbank.terminalKey}
              onChange={(e) => setTbank((prev) => ({ ...prev, terminalKey: e.target.value }))}
              placeholder="TinkoffTerminalKey"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* Пароль терминала */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Пароль терминала (Secret Password)</label>
            <input
              type="password"
              value={tbank.secretPassword}
              onChange={(e) => setTbank((prev) => ({ ...prev, secretPassword: e.target.value }))}
              placeholder="••••••••••••••••"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>

          {/* Тестовый режим */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/30">
            <div>
              <div className="text-sm font-medium">Тестовый режим (Sandbox)</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {tbank.sandbox
                  ? "Платежи не реальные — используйте тестовые карты"
                  : "Реальные платежи — деньги будут списываться с карт"}
              </div>
            </div>
            <button
              onClick={() => setTbank((prev) => ({ ...prev, sandbox: !prev.sandbox }))}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${tbank.sandbox ? "bg-yellow-500" : "bg-green-500"}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${tbank.sandbox ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>

          {/* Кнопка сохранения */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={handleSaveTbank}
              className="px-5 py-2.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500 transition-colors flex items-center gap-2"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                <polyline points="17 21 17 13 7 13 7 21" />
                <polyline points="7 3 7 8 15 8" />
              </svg>
              Сохранить настройки Т-Банк
            </button>
            {tbankSaved && (
              <span className="flex items-center gap-1.5 text-xs text-positive animate-fade-in">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                Сохранено
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
           БЛОК 2: ТАРИФЫ И СБП
           ═══════════════════════════════════════════════════════ */}
      <div className="card-fin p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gold/15 border border-gold/30 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Тарифы и СБП (пополнение токенов)</div>
            <div className="text-xs text-muted-foreground">Управление тарифами и настройками СБП</div>
          </div>
        </div>

        {/* Таблица тарифов */}
        <div className="mb-5">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 gold-line pl-3">Доступные тарифы</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {tariffs.map((t) => (
              <div
                key={t.name}
                className={`relative rounded-lg border p-4 ${
                  t.recommended
                    ? "border-gold/40 bg-gold/5"
                    : "border-border bg-secondary/20"
                }`}
              >
                {t.recommended && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[10px] bg-gold text-primary-foreground px-3 py-0.5 rounded-full font-semibold whitespace-nowrap">
                    Рекомендуем
                  </span>
                )}
                <div className="text-sm font-semibold text-foreground mb-1">{t.name}</div>
                <div className="text-lg font-bold text-gold mb-1">{t.price}</div>
                <div className="text-xs text-muted-foreground mb-2">
                  {t.tokens} токенов · {t.docs}
                </div>
                <ul className="space-y-1">
                  {t.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-positive flex-shrink-0 mt-0.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Наценка сервиса */}
          <div className="mt-3 p-3 rounded-lg border border-yellow-900/30 bg-yellow-900/10 flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-400 flex-shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <div className="text-xs text-yellow-300">
              <span className="font-semibold">Наценка сервиса: +200%</span>
              <span className="text-yellow-400/70 ml-2">Стоимость токенов для пользователя = себестоимость ИИ × 3</span>
            </div>
          </div>
        </div>

        {/* Настройки СБП */}
        <div className="border-t border-border pt-4">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3 gold-line pl-3">Настройки СБП</div>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">ID Мерчанта СБП</label>
              <input
                type="text"
                value={sbp.merchantId}
                onChange={(e) => setSbp((prev) => ({ ...prev, merchantId: e.target.value }))}
                placeholder="merchant-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSaveSbp}
                className="px-5 py-2.5 bg-gold text-primary-foreground rounded text-sm font-medium hover:bg-yellow-500 transition-colors flex items-center gap-2"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Сохранить настройки СБП
              </button>
              {sbpSaved && (
                <span className="flex items-center gap-1.5 text-xs text-positive animate-fade-in">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Сохранено
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════
           БЛОК 3: РУЧНОЕ НАЧИСЛЕНИЕ ТОКЕНОВ
           ═══════════════════════════════════════════════════════ */}
      <div className="card-fin p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-900/20 border border-purple-700/30 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
              <path d="M12 2a4 4 0 0 1 4 4c0 2-2 4-4 4s-4-2-4-4a4 4 0 0 1 4-4z" />
              <path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4z" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Ручное начисление токенов</div>
            <div className="text-xs text-muted-foreground">Пополнение баланса клиента вручную (пока без привязки к бэкенду)</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Email пользователя</label>
            <input
              type="email"
              value={manualEmail}
              onChange={(e) => setManualEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Количество токенов</label>
            <input
              type="number"
              value={manualTokens}
              onChange={(e) => setManualTokens(e.target.value)}
              placeholder="100"
              min="1"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleManualTokens}
            className="px-5 py-2.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-500 transition-colors flex items-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Начислить токены
          </button>
          {manualResult && (
            <span
              className={`flex items-center gap-1.5 text-xs animate-fade-in ${
                manualResult.ok ? "text-positive" : "text-negative"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {manualResult.ok
                  ? <polyline points="20 6 9 17 4 12" />
                  : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                }
              </svg>
              {manualResult.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Компонент вкладки ПОЛЬЗОВАТЕЛИ
// ═══════════════════════════════════════════════════════════════
function UsersTab() {
  const [users, setUsers] = useState(getAllUsers());
  const [helpers, setHelpers] = useState(getAdminHelpers());
  const [helperEmail, setHelperEmail] = useState("");
  const [helperResult, setHelperResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [tokenEmail, setTokenEmail] = useState("");
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenResult, setTokenResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [resetResult, setResetResult] = useState<{ ok: boolean; message: string } | null>(null);

  const refresh = () => {
    setUsers(getAllUsers());
    setHelpers(getAdminHelpers());
  };

  const handleAddHelper = () => {
    if (!helperEmail.trim()) {
      setHelperResult({ ok: false, message: "Введите email" });
      return;
    }
    const ok = addAdminHelper(helperEmail.trim());
    if (ok) {
      setHelperResult({ ok: true, message: `Админ-помощник ${helperEmail.trim()} добавлен` });
      setHelperEmail("");
      refresh();
    } else {
      setHelperResult({ ok: false, message: "Этот email уже является админ-помощником" });
    }
    setTimeout(() => setHelperResult(null), 4000);
  };

  const handleRemoveHelper = (email: string) => {
    removeAdminHelper(email);
    refresh();
  };

  const handleDeleteUser = (email: string) => {
    if (email === ADMIN_EMAIL) return;
    if (!window.confirm(`Удалить пользователя ${email}?`)) return;
    deleteUser(email);
    refresh();
  };

  const handleAddTokens = () => {
    if (!tokenEmail.trim() || !tokenAmount.trim()) {
      setTokenResult({ ok: false, message: "Заполните оба поля" });
      return;
    }
    const count = parseInt(tokenAmount, 10);
    if (isNaN(count) || count <= 0) {
      setTokenResult({ ok: false, message: "Количество должно быть положительным числом" });
      return;
    }
    addTokens(tokenEmail.trim(), count);
    setTokenResult({ ok: true, message: `Начислено ${count} токенов пользователю ${tokenEmail.trim()}` });
    setTokenEmail("");
    setTokenAmount("");
    refresh();
    setTimeout(() => setTokenResult(null), 4000);
  };

  return (
    <div className="space-y-5">
      {/* Список пользователей */}
      <div className="card-fin p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-900/20 border border-blue-700/30 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Все пользователи</div>
            <div className="text-xs text-muted-foreground">Всего: {users.length}</div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Email</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Имя</th>
                <th className="text-left py-2 px-2 text-muted-foreground font-medium">Компания</th>
                <th className="text-right py-2 px-2 text-muted-foreground font-medium">Токены</th>
                <th className="text-center py-2 px-2 text-muted-foreground font-medium">Роль</th>
                <th className="text-center py-2 px-2 text-muted-foreground font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isSuperAdmin = u.email === ADMIN_EMAIL;
                const isHelper = helpers.includes(u.email);
                return (
                  <tr key={u.email} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="py-2.5 px-2 font-medium text-foreground">{u.email}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">{u.name}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">{u.company || "—"}</td>
                    <td className="py-2.5 px-2 text-right font-mono-fin text-gold">{u.tokens.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-center">
                      {isSuperAdmin ? (
                        <span className="text-[10px] bg-gold/20 text-gold px-2 py-0.5 rounded-full font-semibold">Суперадмин</span>
                      ) : isHelper ? (
                        <span className="text-[10px] bg-purple-900/30 text-purple-400 px-2 py-0.5 rounded-full font-semibold">Помощник</span>
                      ) : (
                        <span className="text-[10px] bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">Пользователь</span>
                      )}
                    </td>
                    <td className="py-2.5 px-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {!isSuperAdmin && (
                          <>
                            {isHelper ? (
                              <button
                                onClick={() => handleRemoveHelper(u.email)}
                                className="text-[10px] px-2 py-1 rounded border border-purple-900/30 text-purple-400 hover:bg-purple-900/20 transition-colors"
                                title="Убрать права админа-помощника"
                              >
                                Убрать помощника
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  addAdminHelper(u.email);
                                  refresh();
                                }}
                                className="text-[10px] px-2 py-1 rounded border border-border text-muted-foreground hover:text-purple-400 hover:border-purple-900/30 transition-colors"
                                title="Сделать админом-помощником"
                              >
                                Сделать помощником
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteUser(u.email)}
                              className="text-[10px] px-2 py-1 rounded border border-red-900/30 text-negative hover:bg-red-900/20 transition-colors"
                              title="Удалить пользователя"
                            >
                              Удалить
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Добавление админа-помощника по email */}
      <div className="card-fin p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-purple-900/20 border border-purple-700/30 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Добавить админа-помощника</div>
            <div className="text-xs text-muted-foreground">Пользователь с этим email получит доступ к Панели мозга</div>
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="text-xs text-muted-foreground block mb-1.5">Email пользователя</label>
            <input
              type="email"
              value={helperEmail}
              onChange={(e) => setHelperEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <button
            onClick={handleAddHelper}
            className="px-5 py-2.5 bg-purple-600 text-white rounded text-sm font-medium hover:bg-purple-500 transition-colors flex items-center gap-2 flex-shrink-0"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Добавить
          </button>
        </div>
        {helperResult && (
          <div className={`mt-3 flex items-center gap-2 text-xs ${helperResult.ok ? "text-positive" : "text-negative"} animate-fade-in`}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {helperResult.ok
                ? <polyline points="20 6 9 17 4 12" />
                : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
              }
            </svg>
            {helperResult.message}
          </div>
        )}
      </div>

      {/* Сброс пароля суперадмина */}
      <div className="card-fin p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-red-900/20 border border-red-700/30 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Сброс пароля суперадмина</div>
            <div className="text-xs text-muted-foreground">Если забыли пароль — сбросьте на admin123</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const ok = resetSuperAdminPassword();
              if (ok) {
                setResetResult({ ok: true, message: "Пароль сброшен на admin123. Выйдите и войдите заново." });
              } else {
                setResetResult({ ok: false, message: "Ошибка: суперадмин не найден" });
              }
              setTimeout(() => setResetResult(null), 6000);
            }}
            className="px-5 py-2.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-500 transition-colors flex items-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Сбросить пароль
          </button>
          {resetResult && (
            <span className={`flex items-center gap-1.5 text-xs animate-fade-in ${resetResult.ok ? "text-positive" : "text-negative"}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {resetResult.ok
                  ? <polyline points="20 6 9 17 4 12" />
                  : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                }
              </svg>
              {resetResult.message}
            </span>
          )}
        </div>
      </div>

      {/* Начисление токенов */}
      <div className="card-fin p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-green-900/20 border border-green-700/30 flex items-center justify-center flex-shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Начислить токены пользователю</div>
            <div className="text-xs text-muted-foreground">Пополнить баланс токенов вручную</div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Email пользователя</label>
            <input
              type="email"
              value={tokenEmail}
              onChange={(e) => setTokenEmail(e.target.value)}
              placeholder="user@example.com"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Количество токенов</label>
            <input
              type="number"
              value={tokenAmount}
              onChange={(e) => setTokenAmount(e.target.value)}
              placeholder="100"
              min="1"
              className="w-full bg-secondary border border-border rounded px-3 py-2.5 text-sm font-mono-fin text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <button
            onClick={handleAddTokens}
            className="px-5 py-2.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-500 transition-colors flex items-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Начислить
          </button>
          {tokenResult && (
            <span className={`flex items-center gap-1.5 text-xs animate-fade-in ${tokenResult.ok ? "text-positive" : "text-negative"}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {tokenResult.ok
                  ? <polyline points="20 6 9 17 4 12" />
                  : <><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></>
                }
              </svg>
              {tokenResult.message}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Основной компонент
// ═══════════════════════════════════════════════════════════════
export default function BrainPanel() {
  const [activeTab, setActiveTab] = useState<BrainTab>("payments");

  // ═══════════════════════════════════════════════════════════
  //  Открытый доступ: МОЗГ виден всем без входа
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="animate-fade-in w-full max-w-6xl space-y-4">
      {/* ── Горизонтальное меню вкладок ─────────────────────── */}
      <div className="overflow-x-auto pb-1 -mx-1 px-1">
        <div className="flex gap-1 min-w-max border-b border-border">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  relative px-4 py-2.5 text-xs font-semibold tracking-wider whitespace-nowrap
                  transition-all duration-200 rounded-t-lg
                  ${
                    isActive
                      ? "text-gold bg-gold/5 border-t border-l border-r border-gold/30"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50 border-t border-l border-r border-transparent"
                  }
                `}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Контент вкладки ─────────────────────────────────── */}
      <div className="card-fin p-6">
        {activeTab === "engine" ? (
          <EngineSettings />
        ) : activeTab === "payments" ? (
          <PaymentsTab />
        ) : activeTab === "users" ? (
          <UsersTab />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
            <div className="w-14 h-14 rounded-full bg-gold/10 border border-gold/20 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                <path d="M12 2a4 4 0 0 1 4 4c0 2-2 4-4 4s-4-2-4-4a4 4 0 0 1 4-4z" />
                <path d="M12 14c-4 0-6 2-6 4v2h12v-2c0-2-2-4-6-4z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-foreground">{tabLabels[activeTab]}</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Раздел «{tabLabels[activeTab]}» пока пуст.
              <br />
              Наполнение будет добавлено в следующих обновлениях.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
