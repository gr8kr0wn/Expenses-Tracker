export async function onRequestGet({ request, env }) {
  const userId = request.user.id;
  // Return both default categories (user_id IS NULL) and user's custom categories
  const { results } = await env.DB.prepare('SELECT * FROM categories WHERE user_id IS NULL OR user_id = ?').bind(userId).all();
  return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestPost({ request, env }) {
  const userId = request.user.id;
  const body = await request.json();
  const id = 'c' + Date.now();
  await env.DB.prepare('INSERT INTO categories (id, user_id, name, icon, type, is_default) VALUES (?, ?, ?, ?, ?, 0)')
    .bind(id, userId, body.name, body.icon, body.type).run();
  return new Response(JSON.stringify({ id, ...body }), { status: 201, headers: { 'Content-Type': 'application/json' } });
}

export async function onRequestDelete({ request, env }) {
  const userId = request.user.id;
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();
  await env.DB.prepare('DELETE FROM categories WHERE id = ? AND user_id = ? AND is_default = 0').bind(id, userId).run();
  return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
}
