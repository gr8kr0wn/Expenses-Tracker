async function verifyToken(token, secret) {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const key = await crypto.subtle.importKey('raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token');
  const [headerB64, payloadB64, signatureB64] = parts;
  const signature = Uint8Array.from(atob(signatureB64), c => c.charCodeAt(0));
  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const valid = await crypto.subtle.verify('HMAC', key, signature, data);
  if (!valid) throw new Error('Invalid signature');
  return JSON.parse(atob(payloadB64));
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);

  // Allow CORS preflight, public auth routes, and static files
  if (request.method === 'OPTIONS' || url.pathname.startsWith('/api/auth/') || !url.pathname.startsWith('/api/')) {
    return next();
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = await verifyToken(token, env.JWT_SECRET || 'change-me-to-a-random-string');
    request.user = payload;  // { id, email }
    return next();
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
