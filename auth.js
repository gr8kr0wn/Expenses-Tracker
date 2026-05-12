const API_BASE = '/api';

async function hashPassword(password) {
  // Keep for potential fallback, but not needed server-side
}

async function signupUser(name, email, password) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password })
  });
  const data = await res.json();
  if (data.ok) {
    localStorage.setItem('ff_token', data.token);
    localStorage.setItem('ff_user', JSON.stringify(data.user));
    return { ok: true };
  }
  return { ok: false, error: data.error };
}

async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await res.json();
  if (data.ok) {
    localStorage.setItem('ff_token', data.token);
    localStorage.setItem('ff_user', JSON.stringify(data.user));
    return { ok: true };
  }
  return { ok: false, error: data.error };
}

function getSession() {
  try { return JSON.parse(localStorage.getItem('ff_user')); } catch { return null; }
}

function setSession(user) {
  localStorage.setItem('ff_user', JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem('ff_token');
  localStorage.removeItem('ff_user');
}

function isLoggedIn() {
  return !!localStorage.getItem('ff_token');
}

function getToken() {
  return localStorage.getItem('ff_token');
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.replace('login.html');
    throw new Error('Not authenticated');
  }
}

function requireGuest() {
  if (isLoggedIn()) {
    window.location.replace('flowfinance.html');
    throw new Error('Already authenticated');
  }
}

function logoutUser() {
  clearSession();
  window.location.replace('login.html');
}
