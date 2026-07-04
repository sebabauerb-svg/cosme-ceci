import type { APIRoute } from 'astro';
import {
  ADMIN_COOKIE,
  SESION_TTL_S,
  adminConfigurado,
  crearTokenSesion,
  passwordOk,
} from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

/**
 * Rate limiting best-effort por IP contra fuerza bruta.
 * OJO: en serverless (Vercel) el Map vive por instancia y se reinicia en cold
 * start, así que frena ráfagas sostenidas pero no es un límite global fuerte.
 * Para blindaje real, mover a Vercel KV / Upstash.
 */
const MAX_INTENTOS = 5;
const VENTANA_MS = 10 * 60 * 1000; // 10 min
const intentos = new Map<string, { n: number; hasta: number }>();

function rateBloqueado(ip: string): number {
  const reg = intentos.get(ip);
  if (reg && reg.hasta > Date.now() && reg.n >= MAX_INTENTOS) return reg.hasta - Date.now();
  return 0;
}
function registrarFallo(ip: string) {
  const ahora = Date.now();
  const reg = intentos.get(ip);
  if (!reg || reg.hasta <= ahora) intentos.set(ip, { n: 1, hasta: ahora + VENTANA_MS });
  else reg.n++;
}

export const POST: APIRoute = async ({ request, cookies, clientAddress }) => {
  if (!adminConfigurado()) {
    return json({ ok: false, error: 'Falta configurar ADMIN_PASSWORD en Vercel.' }, 500);
  }

  const ip = clientAddress || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'desconocida';
  const restanteMs = rateBloqueado(ip);
  if (restanteMs > 0) {
    const min = Math.ceil(restanteMs / 60000);
    return json(
      { ok: false, error: `Demasiados intentos. Probá de nuevo en ${min} min.` },
      429
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (!passwordOk(body?.password)) {
    registrarFallo(ip);
    return json({ ok: false, error: 'Contraseña incorrecta.' }, 401);
  }

  const token = crearTokenSesion();
  if (!token) {
    return json({ ok: false, error: 'Falta configurar ADMIN_PASSWORD en Vercel.' }, 500);
  }
  intentos.delete(ip); // login exitoso → limpiamos el contador
  cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    path: '/',
    maxAge: SESION_TTL_S,
  });
  return json({ ok: true });
};

export const DELETE: APIRoute = async ({ cookies }) => {
  cookies.delete(ADMIN_COOKIE, { path: '/' });
  return json({ ok: true });
};
