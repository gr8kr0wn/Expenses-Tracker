export async function onRequestGet({ request, env }) {
  const userId = request.user.id;
  const sett = await env.DB.prepare('SELECT * FROM settings WHERE user_id = ?').bind(userId).first();
  return new Response(JSON.stringify(sett || {}), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPut({ request, env }) {
  const userId = request.user.id;
  const body = await request.json();
  await env.DB.prepare('INSERT OR REPLACE INTO settings (user_id, name, currency, income_target) VALUES (?, ?, ?, ?)')
    .bind(userId, body.name, body.currency || 'NGN', body.incomeTarget || 0).run();
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}
