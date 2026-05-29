/**
 * Система аутентификации для многопользовательского SaaS.
 * Хранит пользователей в localStorage (для MVP).
 * В реальном проекте — Supabase / Auth0 / Firebase.
 */

export const ADMIN_EMAIL = "denittt@yandex.ru";
export const FREE_TOKENS = 50; // Бесплатные токены при регистрации

export interface User {
  email: string;
  name: string;
  company: string;
  tokens: number;
  balance: number; // реальные деньги на счету (₽)
  isAdmin: boolean;
  createdAt: string;
}

interface StoredUser {
  email: string;
  name: string;
  company: string;
  password: string;
  tokens: number;
  balance: number;
  isAdmin: boolean;
  createdAt: string;
}

const USERS_KEY = "bg_users";
const SESSION_KEY = "bg_session";

// ── Вспомогательные функции ──────────────────────────────────

function getUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveUsers(users: StoredUser[]) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

function getSession(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

function setSession(email: string) {
  localStorage.setItem(SESSION_KEY, email);
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ── Инициализация: создаём суперадмина если его нет ──
function ensureSuperAdmin() {
  const users = getUsers();
  const existing = users.find((u) => u.email === ADMIN_EMAIL);
  if (!existing) {
    users.push({
      email: ADMIN_EMAIL,
      name: "Администратор",
      company: "Butsky Group",
      password: "123456789",
      tokens: 999999,
      balance: 0,
      isAdmin: true,
      createdAt: new Date().toISOString(),
    });
    saveUsers(users);
  }
}
ensureSuperAdmin();

// ── Публичное API ───────────────────────────────────────────

/** Регистрация нового пользователя */
export function registerUser(
  email: string,
  password: string,
  name: string,
  company: string
): { ok: boolean; error?: string } {
  const users = getUsers();
  if (users.find((u) => u.email === email)) {
    return { ok: false, error: "Пользователь с таким email уже существует" };
  }
  if (password.length < 6) {
    return { ok: false, error: "Пароль должен быть не менее 6 символов" };
  }
  users.push({
    email,
    name,
    company,
    password,
    tokens: FREE_TOKENS,
    balance: 0,
    isAdmin: false,
    createdAt: new Date().toISOString(),
  });
  saveUsers(users);
  return { ok: true };
}

/** Вход пользователя */
export function loginUser(
  email: string,
  password: string
): { ok: boolean; error?: string; user?: User } {
  const users = getUsers();
  const found = users.find((u) => u.email === email);
  if (!found) {
    return { ok: false, error: "Пользователь не найден" };
  }
  if (found.password !== password) {
    return { ok: false, error: "Неверный пароль" };
  }
  setSession(email);
  return {
    ok: true,
    user: {
      email: found.email,
      name: found.name,
      company: found.company,
      tokens: found.tokens,
      balance: found.balance || 0,
      isAdmin: found.isAdmin,
      createdAt: found.createdAt,
    },
  };
}

/** Выход */
export function logoutUser() {
  clearSession();
}

/** Восстановление пароля (для MVP — просто сбрасываем на "123456") */
export function resetPassword(email: string): { ok: boolean; error?: string } {
  const users = getUsers();
  const found = users.find((u) => u.email === email);
  if (!found) {
    return { ok: false, error: "Пользователь с таким email не найден" };
  }
  found.password = "123456";
  saveUsers(users);
  return { ok: true };
}

/** Сменить пароль */
export function changePassword(
  email: string,
  oldPassword: string,
  newPassword: string
): { ok: boolean; error?: string } {
  const users = getUsers();
  const found = users.find((u) => u.email === email);
  if (!found) {
    return { ok: false, error: "Пользователь не найден" };
  }
  if (found.password !== oldPassword) {
    return { ok: false, error: "Неверный текущий пароль" };
  }
  if (newPassword.length < 6) {
    return { ok: false, error: "Новый пароль должен быть не менее 6 символов" };
  }
  found.password = newPassword;
  saveUsers(users);
  return { ok: true };
}

/** Получить текущего пользователя из сессии */
export function getCurrentUser(): User | null {
  const email = getSession();
  if (!email) return null;
  const users = getUsers();
  const found = users.find((u) => u.email === email);
  if (!found) return null;
  return {
    email: found.email,
    name: found.name,
    company: found.company,
    tokens: found.tokens,
    balance: found.balance || 0,
    isAdmin: found.isAdmin,
    createdAt: found.createdAt,
  };
}

/** Проверка, является ли пользователь администратором */
export function isAdmin(email: string): boolean {
  return email === ADMIN_EMAIL;
}

/** Проверка, является ли пользователь админом или админом-помощником */
export function isAdminOrHelper(email: string): boolean {
  if (email === ADMIN_EMAIL) return true;
  const helpers = getAdminHelpers();
  return helpers.includes(email);
}

/** Списать токены у пользователя */
export function spendTokens(email: string, amount: number): boolean {
  const users = getUsers();
  const found = users.find((u) => u.email === email);
  if (!found || found.tokens < amount) return false;
  found.tokens -= amount;
  saveUsers(users);
  return true;
}

/** Начислить токены пользователю */
export function addTokens(email: string, amount: number) {
  const users = getUsers();
  const found = users.find((u) => u.email === email);
  if (!found) return;
  found.tokens += amount;
  saveUsers(users);
}

/** Пополнить баланс (реальные деньги) */
export function addBalance(email: string, amount: number) {
  const users = getUsers();
  const found = users.find((u) => u.email === email);
  if (!found) return;
  found.balance = (found.balance || 0) + amount;
  saveUsers(users);
}

/** Получить всех пользователей (для админки) */
export function getAllUsers(): User[] {
  return getUsers().map((u) => ({
    email: u.email,
    name: u.name,
    company: u.company,
    tokens: u.tokens,
    balance: u.balance || 0,
    isAdmin: u.isAdmin,
    createdAt: u.createdAt,
  }));
}

/** Удалить пользователя (для админки) */
export function deleteUser(email: string): boolean {
  if (email === ADMIN_EMAIL) return false; // нельзя удалить суперадмина
  const users = getUsers().filter((u) => u.email !== email);
  saveUsers(users);
  return true;
}


// ── Админы-помощники ────────────────────────────────────────

const HELPERS_KEY = "bg_admin_helpers";

export function getAdminHelpers(): string[] {
  try {
    const raw = localStorage.getItem(HELPERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

export function addAdminHelper(email: string): boolean {
  const helpers = getAdminHelpers();
  if (helpers.includes(email)) return false;
  helpers.push(email);
  localStorage.setItem(HELPERS_KEY, JSON.stringify(helpers));
  return true;
}

export function removeAdminHelper(email: string): boolean {
  const helpers = getAdminHelpers().filter((e) => e !== email);
  localStorage.setItem(HELPERS_KEY, JSON.stringify(helpers));
  return true;
}

/**
 * Принудительно сбрасывает пароль суперадмина на "admin123".
 * Используется, если забыли пароль.
 */
export function resetSuperAdminPassword(): boolean {
  const users = getUsers();
  const idx = users.findIndex((u) => u.email === ADMIN_EMAIL);
  if (idx === -1) return false;
  users[idx].password = "admin123";
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
  return true;
}
