/**
 * FlowFinance — auth.js
 * Handles signup, login, session, and route guards.
 * Must be loaded BEFORE Alpine and app.js on the dashboard.
 */

const FF_USERS_KEY   = 'ff_users';
const FF_SESSION_KEY = 'ff_session';

/* ── Password hashing ───────────────────────────────────────
   Uses SHA-256 via Web Crypto when available (https / localhost).
   Falls back to a simple deterministic hash for file:// access.
────────────────────────────────────────────────────────────── */
async function hashPassword(password) {
  const salted = password + '_ff_2025_salt';
  if (window.crypto && window.crypto.subtle) {
    try {
      const data = new TextEncoder().encode(salted);
      const buf  = await crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch(e) {
      // fall through to fallback
    }
  }
  // Fallback for file:// — deterministic btoa hash
  let hash = 0;
  for (let i = 0; i < salted.length; i++) {
    const chr = salted.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return btoa(salted + hash).replace(/[^a-zA-Z0-9]/g, '').slice(0, 64);
}

/* ── Session ─────────────────────────────────────────────── */
function getSession() {
  try { return JSON.parse(localStorage.getItem(FF_SESSION_KEY)); } catch { return null; }
}
function setSession(user) {
  localStorage.setItem(FF_SESSION_KEY, JSON.stringify({ email: user.email, name: user.name }));
}
function clearSession() {
  localStorage.removeItem(FF_SESSION_KEY);
}
function isLoggedIn() {
  return !!getSession();
}

/* ── User store ──────────────────────────────────────────── */
function getUsers() {
  try { return JSON.parse(localStorage.getItem(FF_USERS_KEY)) || {}; } catch { return {}; }
}
function saveUsers(u) {
  localStorage.setItem(FF_USERS_KEY, JSON.stringify(u));
}

/* ── Route guards ────────────────────────────────────────── */
function requireAuth() {
  if (!isLoggedIn()) {
    window.location.replace('login.html');
    throw new Error('Not authenticated — redirecting to login');
  }
  const session  = getSession();
  const existing = localStorage.getItem('ff_s');
  if (!existing && session && session.name) {
    localStorage.setItem('ff_s', JSON.stringify({
      name: session.name, currency: 'NGN', incomeTarget: 0
    }));
  }
}

function requireGuest() {
  if (isLoggedIn()) {
    window.location.replace('flowfinance.html');
    throw new Error('Already authenticated — redirecting to dashboard');
  }
}

/* ── Signup ──────────────────────────────────────────────── */
async function signupUser(name, email, password) {
  const users = getUsers();
  const key   = email.toLowerCase().trim();
  if (users[key]) return { ok: false, error: 'An account with this email already exists.' };

  const passwordHash = await hashPassword(password);
  users[key] = { name: name.trim(), email: key, passwordHash };
  saveUsers(users);
  setSession(users[key]);

  if (!localStorage.getItem('ff_s')) {
    localStorage.setItem('ff_s', JSON.stringify({
      name: name.trim(), currency: 'NGN', incomeTarget: 0
    }));
    localStorage.setItem('ff_ob', '1');
  }
  return { ok: true };
}

/* ── Login ───────────────────────────────────────────────── */
async function loginUser(email, password) {
  const users = getUsers();
  const key   = email.toLowerCase().trim();
  const user  = users[key];
  if (!user) return { ok: false, error: 'No account found with this email.' };

  const passwordHash = await hashPassword(password);
  if (passwordHash !== user.passwordHash) return { ok: false, error: 'Incorrect password. Please try again.' };

  setSession(user);
  return { ok: true };
}

/* ── Logout ──────────────────────────────────────────────── */
function logoutUser() {
  clearSession();
  window.location.replace('login.html');
}
