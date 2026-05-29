import { useState } from "react";
import { loginUser, resetPassword } from "@/lib/auth";

interface AuthPageProps {
  onAuthSuccess: () => void;
  /** Причина показа — для контекстного сообщения */
  reason?: string;
}

export default function AuthPage({ onAuthSuccess, reason }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      if (mode === "login") {
        const res = loginUser(email, password);
        if (!res.ok) {
          setError(res.error || "Ошибка входа");
          setLoading(false);
          return;
        }
        onAuthSuccess();
      } else if (mode === "reset") {
        const res = resetPassword(email);
        if (!res.ok) {
          setError(res.error || "Ошибка");
          setLoading(false);
          return;
        }
        setSuccess("Пароль сброшен на 123456. Войдите с этим паролем.");
        setTimeout(() => {
          setMode("login");
          setSuccess("");
        }, 3000);
      }
    } catch (e) {
      setError("Произошла ошибка. Попробуйте ещё раз.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
        {/* Шапка */}
        <div className="px-6 pt-6 pb-2 text-center">
          <div className="w-12 h-12 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">
            {mode === "login" ? "Вход в систему" : "Восстановление пароля"}
          </h2>
          {reason && (
            <p className="text-xs text-muted-foreground mt-1">{reason}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
          {/* Email */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          {/* Пароль — только для входа */}
          {mode === "login" && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Пароль</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Ошибка / успех */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/30 text-xs text-negative animate-fade-in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-900/20 border border-green-900/30 text-xs text-positive animate-fade-in">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {success}
            </div>
          )}

          {/* Кнопка */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-gold text-primary-foreground rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <div className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
            ) : mode === "login" ? (
              "Войти"
            ) : (
              "Сбросить пароль"
            )}
          </button>

          {/* Ссылки */}
          <div className="flex flex-col items-center gap-1.5 pt-1">
            {mode === "login" && (
              <button
                type="button"
                onClick={() => { setMode("reset"); setError(""); setSuccess(""); }}
                className="text-xs text-muted-foreground hover:text-gold transition-colors"
              >
                Забыли пароль?
              </button>
            )}
            {mode === "reset" && (
              <button
                type="button"
                onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                className="text-xs text-muted-foreground hover:text-gold transition-colors"
              >
                Вернуться ко входу
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
