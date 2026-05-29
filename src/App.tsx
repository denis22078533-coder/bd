import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Icon from "@/components/ui/icon";
import Dashboard from "@/pages/Dashboard";
import Transactions from "@/pages/Transactions";
import Documents from "@/pages/Documents";
import AiChat from "@/pages/AiChat";
import TaxReports from "@/pages/TaxReports";
import AdminSettings from "@/pages/AdminSettings";
import AuthPage from "@/pages/AuthPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PaymentModal } from "@/components/PaymentModal";
import { getCurrentUser, logoutUser } from "@/lib/auth";

type Section = "dashboard" | "transactions" | "documents" | "chat" | "taxes" | "admin";

const nav: { id: Section; label: string; icon: string; shortLabel: string; badge?: string }[] = [
  { id: "dashboard", label: "Главная", shortLabel: "Главная", icon: "LayoutDashboard" },
  { id: "transactions", label: "История операций", shortLabel: "Операции", icon: "List" },
  { id: "documents", label: "Документы", shortLabel: "Документы", icon: "ScanLine", badge: "ИИ" },
  { id: "chat", label: "ИИ-ассистент", shortLabel: "ИИ-чат", icon: "MessageSquare", badge: "ИИ" },
  { id: "taxes", label: "Налоговая отчётность", shortLabel: "Отчёты", icon: "FileBarChart" },
  { id: "admin", label: "МОЗГ", shortLabel: "МОЗГ", icon: "Brain" },
];

const titles: Record<Section, string> = {
  dashboard: "Обзор",
  transactions: "История операций",
  documents: "Документы",
  chat: "ИИ-ассистент",
  taxes: "Налоговая отчётность",
  admin: "Настройки",
};

const App = () => {
  const [user, setUser] = useState(getCurrentUser());
  const [section, setSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [authReason, setAuthReason] = useState("");
  const [showPayment, setShowPayment] = useState(false);

  useEffect(() => {
    const current = getCurrentUser();
    setUser(current);
  }, []);

  const handleAuthSuccess = () => {
    setUser(getCurrentUser());
    setShowAuth(false);
  };

  const handleLogout = () => {
    logoutUser();
    setUser(null);
  };

  const handleAuthClick = () => {
    setShowAuth(true);
    setAuthReason("");
  };

  const visibleNav = nav;

  const content = {
    dashboard: <Dashboard onNavigate={(s) => setSection(s as Section)} />,
    transactions: <Transactions />,
    documents: <Documents />,
    chat: <AiChat />,
    taxes: <TaxReports />,
    admin: <AdminSettings />,
  }[section];

  return (
    <TooltipProvider>
      <Toaster />
      {showAuth && <AuthPage onAuthSuccess={handleAuthSuccess} reason={authReason} />}
      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onSuccess={() => {
            setUser(getCurrentUser());
            setShowPayment(false);
          }}
        />
      )}

      <div className="flex h-[100dvh] bg-background overflow-hidden">
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        <aside className={`
          fixed lg:static inset-y-0 left-0 z-30 w-60 flex flex-col
          bg-sidebar border-r border-sidebar-border
          transition-transform duration-200
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}>
          <div className="px-4 py-4 border-b border-sidebar-border">
            <div className="flex items-center gap-3 group cursor-default">
              <div className="flex-shrink-0 w-10 h-10 relative transition-transform duration-300 group-hover:scale-105">
                <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g transform="translate(5, 5)">
                    <path d="M18 10 Q25 2 32 10 L30 18 Q25 15 20 18 Z" fill="#e879f9" stroke="#d946ef" strokeWidth="1"/>
                    <circle cx="25" cy="22" r="10" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="1"/>
                    <circle cx="21" cy="21" r="3.5" fill="none" stroke="#333" strokeWidth="1.2"/>
                    <circle cx="29" cy="21" r="3.5" fill="none" stroke="#333" strokeWidth="1.2"/>
                    <line x1="24.5" y1="21" x2="25.5" y2="21" stroke="#333" strokeWidth="1.2"/>
                    <circle cx="21" cy="21" r="1" fill="#333"/>
                    <circle cx="29" cy="21" r="1" fill="#333"/>
                    <path d="M21 26 Q25 29 29 26" fill="none" stroke="#c97a5a" strokeWidth="1" strokeLinecap="round"/>
                    <rect x="17" y="32" width="16" height="18" rx="4" fill="#f472b6" stroke="#ec4899" strokeWidth="1"/>
                    <rect x="10" y="34" width="7" height="4" rx="2" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="0.8"/>
                    <rect x="33" y="34" width="7" height="4" rx="2" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="0.8"/>
                  </g>
                  <g transform="translate(50, 5)">
                    <path d="M18 10 Q25 2 32 10 L30 18 Q25 15 20 18 Z" fill="#60a5fa" stroke="#3b82f6" strokeWidth="1"/>
                    <circle cx="22" cy="8" r="1.5" fill="#fff" opacity="0.6"/>
                    <circle cx="28" cy="12" r="1.5" fill="#fff" opacity="0.6"/>
                    <circle cx="25" cy="22" r="10" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="1"/>
                    <circle cx="21" cy="21" r="3.5" fill="none" stroke="#333" strokeWidth="1.2"/>
                    <circle cx="29" cy="21" r="3.5" fill="none" stroke="#333" strokeWidth="1.2"/>
                    <line x1="24.5" y1="21" x2="25.5" y2="21" stroke="#333" strokeWidth="1.2"/>
                    <circle cx="21" cy="21" r="1" fill="#333"/>
                    <circle cx="29" cy="21" r="1" fill="#333"/>
                    <path d="M21 26 Q25 29 29 26" fill="none" stroke="#c97a5a" strokeWidth="1" strokeLinecap="round"/>
                    <rect x="17" y="32" width="16" height="18" rx="4" fill="#34d399" stroke="#10b981" strokeWidth="1"/>
                    <rect x="10" y="34" width="7" height="4" rx="2" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="0.8"/>
                    <rect x="33" y="34" width="7" height="4" rx="2" fill="#fcd9b6" stroke="#e8b88a" strokeWidth="0.8"/>
                  </g>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight tracking-tight text-foreground">Бабки Скан</div>
                <div className="text-[11px] text-[#0284C7] font-medium tracking-wide">Бабушки любят счёт</div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-3 px-2">
            <div className="text-xs text-muted-foreground uppercase tracking-widest px-3 mb-2">Навигация</div>
            <nav className="space-y-0.5">
              {visibleNav.map((item) => {
                const active = section === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSection(item.id); setSidebarOpen(false); }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      active
                        ? "bg-sidebar-accent text-foreground font-medium"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                    }`}
                  >
                    <Icon name={item.icon} size={16} className={active ? "text-gold" : ""} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {active && <span className="w-1 h-4 rounded-full bg-gold" />}
                    {item.badge && !active && (
                      <span className="text-xs bg-gold/20 text-gold px-1.5 py-0.5 rounded font-mono-fin">{item.badge}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="px-4 py-2 border-t border-sidebar-border">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs text-muted-foreground">Токены</span>
              <span className="text-xs font-semibold text-gold">{user?.tokens?.toLocaleString() ?? "—"}</span>
            </div>
            {user && (
              <div className="flex items-center justify-between px-1 mt-1">
                <span className="text-xs text-muted-foreground">Баланс</span>
                <span className="text-xs font-semibold text-positive">{(user.balance || 0).toLocaleString()} ₽</span>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-sidebar-border">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#0284C7]/15 border border-[#0284C7]/30 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-[#0284C7]">
                    {user?.name?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate">{user?.name || "Пользователь"}</div>
                  <div className="text-[11px] text-muted-foreground truncate">{user?.email || ""}</div>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-negative hover:bg-negative/10 transition-all"
                  title="Выйти"
                >
                  <Icon name="LogOut" size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleAuthClick}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-foreground transition-all"
              >
                <Icon name="LogIn" size={16} />
                <span>Войти</span>
              </button>
            )}
          </div>
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="h-12 lg:h-14 border-b border-border flex items-center gap-3 px-4 flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden text-muted-foreground hover:text-foreground transition-colors p-1 -ml-1"
            >
              <Icon name="Menu" size={20} />
            </button>

            <div className="flex-1 flex items-center gap-2 min-w-0">
              <h1 className="text-sm font-semibold truncate">{titles[section]}</h1>
              <span className="text-border hidden sm:block">·</span>
              <span className="text-xs text-muted-foreground font-mono-fin hidden sm:block">
                {new Date().toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              {user && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gold/10 border border-gold/20 lg:hidden">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span className="text-xs font-semibold text-gold">{user?.tokens?.toLocaleString() ?? 0}</span>
                </div>
              )}
              <button className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
                <Icon name="Bell" size={16} />
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-gold" />
              </button>
              <div className="hidden sm:flex items-center gap-1.5">
                <button className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-secondary hover:text-foreground transition-all">
                  <Icon name="HelpCircle" size={16} />
                </button>
                <div className="h-5 w-px bg-border mx-1" />
              </div>
              {user ? (
                <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-secondary transition-all duration-300 cursor-pointer">
                  <div className="w-6 h-6 rounded-full bg-[#0284C7]/20 border border-[#0284C7]/40 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold text-[#0284C7]">
                      {user?.name?.charAt(0)?.toUpperCase() || "?"}
                    </span>
                  </div>
                  <span className="text-xs hidden sm:block font-medium">{user?.name || "Пользователь"}</span>
                </div>
              ) : (
                <button
                  onClick={handleAuthClick}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/20 text-xs font-semibold text-gold hover:bg-gold/20 transition-all"
                >
                  <Icon name="LogIn" size={14} />
                  <span className="hidden sm:inline">Войти</span>
                </button>
              )}
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-3 sm:p-5 pb-20 lg:pb-5">
            <ErrorBoundary>
              {content}
            </ErrorBoundary>
          </main>
        </div>

        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-sidebar flex">
          {visibleNav.map((item) => {
            const active = section === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSection(item.id)}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors relative ${
                  active ? "text-gold" : "text-muted-foreground"
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-gold" />
                )}
                <Icon name={item.icon} size={18} />
                <span className="text-[10px] leading-none">{item.shortLabel}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </TooltipProvider>
  );
};

export default App;