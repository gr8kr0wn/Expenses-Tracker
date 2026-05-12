export async function onRequestGet({ request, env }) {
  const userId = request.user.id;
  const { results } = await env.DB.prepare('SELECT * FROM transactions WHERE user_id = ?')
    .bind(userId).all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPost({ request, env }) {
  const userId = request.user.id;
  const body = await request.json();
  const { amount, type, category, date, description, recurring, frequency } = body;
  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO transactions (id, user_id, amount, type, category_id, date, description, recurring, frequency)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, userId, amount, type, category, date, description || '', recurring ? 1 : 0, frequency || null).run();

  return new Response(JSON.stringify({ id, ...body }), {
    status: 201,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestDelete({ request, env }) {
  const userId = request.user.id;
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop(); // e.g., /api/transactions/123
  await env.DB.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?')
    .bind(id, userId).run();
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function onRequestPut({ request, env }) {
  const userId = request.user.id;
  const url = new URL(request.url);
  const id = url.pathname.split('/').pop();
  const body = await request.json();
  // update fields
  await env.DB.prepare(
    `UPDATE transactions SET amount=?, type=?, category_id=?, date=?, description=?, recurring=?, frequency=? WHERE id=? AND user_id=?`
  ).bind(body.amount, body.type, body.category, body.date, body.description, body.recurring ? 1 : 0, body.frequency || null, id, userId).run();
  return new Response(JSON.stringify({ id, ...body }), {
    headers: { 'Content-Type': 'application/json' }
  });
}
