import type { APIRoute } from 'astro';
import { getSql, ensurePerfil } from '../../../lib/db';
import { pacienteActual, perfilActivo, PACIENTE_COOKIE } from '../../../lib/cuenta';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** GET /api/cuenta/yo → nombre, email y WhatsApp para precargar /reservar. */
export const GET: APIRoute = async ({ cookies }) => {
  if (!perfilActivo() || !cookies.get(PACIENTE_COOKIE)) return json({ ok: false }, 404);
  try {
    const sql = getSql();
    await ensurePerfil(sql);
    const p = await pacienteActual(sql, cookies);
    if (!p) return json({ ok: false }, 401);
    return json({ ok: true, nombre: p.nombre, email: p.email ?? '', telefono: p.telefono ?? '' });
  } catch {
    return json({ ok: false }, 500);
  }
};
