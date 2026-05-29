import { useState } from "react";
import { loginUser, registerUser, addBalance, addTokens } from "@/lib/auth";

interface PaymentModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal = ({ onClose, onSuccess }: PaymentModalProps) => {
  const [payEmail, setPayEmail] = useState("");
  const [payPassword, setPayPassword] = useState("");
  const [payError, setPayError] = useState("");

  const handlePay = () => {
    if (!payEmail.trim() || !payPassword.trim()) {
      setPayError("Заполните все поля");
      return;
    }
    let res = loginUser(payEmail, payPassword);
    if (!res.ok) {
      res = registerUser(payEmail, payPassword, payEmail.split("@")[0], "");
      if (!res.ok) {
        setPayError(res.error || "Ошибка");
        return;
      }
      res = loginUser(payEmail, payPassword);
    }
    if (res.ok) {
      addBalance(payEmail, 500);
      addTokens(payEmail, 100);
      onSuccess();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl animate-fade-in p-6">
        <div className="text-center mb-4">
          <div className="w-12 h-12 rounded-full bg-gold/15 border border-gold/30 flex items-center justify-center mx-auto mb-3">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gold">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-foreground">Не хватает токенов</h2>
          <p className="text-xs text-muted-foreground mt-1">Пополните баланс, чтобы продолжить</p>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Email</label>
            <input
              type="email"
              value={payEmail}
              onChange={(e) => setPayEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Пароль</label>
            <input
              type="password"
              value={payPassword}
              onChange={(e) => setPayPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-gold"
            />
          </div>

          {payError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-900/20 border border-red-900/30 text-xs text-negative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              {payError}
            </div>
          )}

          <button
            onClick={handlePay}
            className="w-full py-2.5 bg-gold text-primary-foreground rounded-lg text-sm font-semibold hover:bg-yellow-500 transition-colors flex items-center justify-center gap-2"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
            Пополнить — 500 ₽
          </button>

          <button
            onClick={onClose}
            className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};