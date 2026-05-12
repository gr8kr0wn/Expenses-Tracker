export async function onRequestGet({ request, env }) {
  const userId = request.user.id;
  const { results } = await env.DB.prepare('SELECT * FROM budgets WHERE user_id = ?').bind(userId).all();
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  const userId = request.user.id;
  const { category, limit } = await request.json();
  const id = crypto.randomUUID();
  await env.DB.prepare('INSERT INTO budgets (id, user_id, category_id, limit_amount) VALUES (?, ?, ?, ?)')
    .bind(id, userId, category, limit).run();
  return new Response(JSON.stringify({ id, category, limit }), { status: 201, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestDelete({ request, env }) {
  const userId = request.user.id;
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();
  await env.DB.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').bind(id, userId).run();
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}
