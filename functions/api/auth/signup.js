async function createJWT(payload, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const header = { alg: 'HS256', typ: 'JWT' };
  const parts = [
    btoa(JSON.stringify(header)),
    btoa(JSON.stringify(payload))
  ].join('.');
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(parts));
  return parts + '.' + btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function onRequestPost({ request, env }) {
  const { name, email, password } = await request.json();

  // Hash password
  const encoder = new TextEncoder();
  const salted = password + '_ff_2025_salt';
  const data = encoder.encode(salted);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashedPassword = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,'0')).join('');

  // Check existing
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (existing) {
    return new Response(JSON.stringify({ ok: false, error: 'Email already registered' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // Insert user
  const result = await env.DB.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)')
    .bind(name, email, hashedPassword).run();
  const userId = result.meta.last_row_id;

  // Create default settings for this user
  await env.DB.prepare('INSERT INTO settings (user_id, name, currency, income_target) VALUES (?, ?, ?, ?)')
    .bind(userId, name, 'NGN', 0).run();

  // Generate token
  const token = await createJWT({ id: userId, email }, env.JWT_SECRET || 'change-me-to-a-random-string');

  return new Response(JSON.stringify({ ok: true, token, user: { name, email } }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
