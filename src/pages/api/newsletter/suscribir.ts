import type { APIRoute } from 'astro';
import { getSql, ensureNewsletter } from '../../../lib/db';
import { baseUrl, normalizarEmail, pedirSuscripcion } from '../../../lib/newsletter';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// Mismo criterio que /api/reservar: freno in-memory por IP. Cada pedido puede
// mandar un mail de confirmación, así que sin freno se usaría para spamear.
const intentosPorIp = new Map<string, { count: number; resetAt: number }>();
function rateLimitOk(ip: string): boolean {
  const ahora = Date.now();
  const cur = intentosPorIp.get(ip);
  if (!cur || cur.resetAt < ahora) {
    intentosPorIp.set(ip, { count: 1, resetAt: ahora + 10 * 60 * 1000 });
    return true;
  }
  return ++cur.count <= 6;
}

const ORIGENES = ['blog', 'home', 'reserva'];

// POST /api/newsletter/suscribir  { email, consentimiento: true, origen, sitio (trampa para bots) }
// Responde siempre igual (no revela si el email ya estaba en la lista).
export const POST: APIRoute = async ({ request, clientAddress }) => {
  let ip = 'desconocida';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || ip;
  } catch {
    /* clientAddress puede lanzar fuera de un request real */
  }
  if (!rateLimitOk(ip)) return json({ ok: false, error: 'Demasiados intentos. Probá de nuevo en unos minutos.' }, 429);

  let b: any;
  try {
    b = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }
  // Campo oculto: una persona no lo ve ni lo completa.
  if (b?.sitio) return json({ ok: true });
  const email = normalizarEmail(b?.email);
  if (!email) return json({ ok: false, error: 'Revisá el email.' }, 400);
  if (b?.consentimiento !== true)
    return json({ ok: false, error: 'Para suscribirte tenés que marcar la casilla de consentimiento.' }, 400);
  const origen = ORIGENES.includes(b?.origen) ? b.origen : 'blog';

  try {
    const sql = getSql();
    await ensureNewsletter(sql);
    await pedirSuscripcion(sql, email, origen, baseUrl(request));
    return json({ ok: true });
  } catch (e) {
    console.error('POST /api/newsletter/suscribir:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos registrar tu email. Probá de nuevo.' }, 500);
  }
};
