import type { APIRoute } from 'astro';
import { ADMIN_COOKIE, adminToken, passwordOk } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const tok = adminToken();
  if (!tok) {
    return json({ ok: false, error: 'Falta configurar ADMIN_PASSWORD en Vercel.' }, 500);
  }
  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  if (!passwordOk(body?.password)) {
    return json({ ok: false, error: 'Contraseña incorrecta.' }, 401);
  }
  cookies.set(ADMIN_COOKIE, tok, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12, // 12 h
  });
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
  return json({ ok: true });
};
