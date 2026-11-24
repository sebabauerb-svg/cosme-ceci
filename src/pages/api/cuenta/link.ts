import type { APIRoute } from 'astro';
import { getSql, ensurePerfil } from '../../../lib/db';
import { baseUrl, normEmail } from '../../../lib/pacientes';
import { ACCESO_MIN, crearAcceso, linkAcceso, linkEnPantalla, pacientePorEmail, perfilActivo } from '../../../lib/cuenta';
import { enviarAccesoCuenta } from '../../../lib/email';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

// Por instancia serverless: corta el abuso barato (mandar mails en loop).
const porIp = new Map<string, { n: number; hasta: number }>();
const porEmail = new Map<string, { n: number; hasta: number }>();
function limite(m: Map<string, { n: number; hasta: number }>, k: string, max: number) {
  const ahora = Date.now();
  const c = m.get(k);
  if (!c || c.hasta < ahora) {
    m.set(k, { n: 1, hasta: ahora + 15 * 60 * 1000 });
    return true;
  }
  return ++c.n <= max;
}

/**
 * POST /api/cuenta/link { email } → manda el link mágico si hay una ficha con
 * ese email. La respuesta es la misma exista o no (así no se puede averiguar
 * quién es paciente).
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!perfilActivo()) return json({ ok: false, error: 'No disponible' }, 404);
  const b = await request.json().catch(() => ({}));
  const email = normEmail(b?.email);
  if (!email) return json({ ok: false, error: 'Revisá el email: no parece válido.' }, 400);
  let ip = 'desconocida';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || ip;
  } catch {
    /* sin IP */
  }
  if (!limite(porIp, ip, 10) || !limite(porEmail, email, 3))
    return json({ ok: false, error: 'Pediste varios links seguidos. Esperá unos minutos y probá de nuevo.' }, 429);
  try {
    const sql = getSql();
    await ensurePerfil(sql);
    const p = await pacientePorEmail(sql, email);
    if (!p) return json({ ok: true });
    const token = await crearAcceso(sql, p.id, typeof b?.destino === 'string' ? b.destino : null);
    const link = linkAcceso(baseUrl(request), token);
    if (linkEnPantalla(email)) return json({ ok: true, prueba: link });
    await enviarAccesoCuenta({ nombre: p.nombre, email: p.email, link, vence: `${ACCESO_MIN} minutos` });
    return json({ ok: true });
  } catch (err) {
    console.error('cuenta/link', err);
    return json({ ok: false, error: 'No pudimos mandar el link. Probá de nuevo en un rato.' }, 500);
  }
};
