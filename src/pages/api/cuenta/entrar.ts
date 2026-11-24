import type { APIRoute } from 'astro';
import { getSql, ensurePerfil } from '../../../lib/db';
import { canjearAcceso, crearSesion, perfilActivo, rutaDestino, tokenFormaOk } from '../../../lib/cuenta';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/**
 * POST /api/cuenta/entrar { t } → canjea el link mágico y abre la sesión.
 * Es POST (con un botón en /mi-cuenta/entrar) y no un GET directo, porque los
 * antivirus de los correos abren los links solos y gastarían el de un uso.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!perfilActivo()) return json({ ok: false, error: 'No disponible' }, 404);
  const b = await request.json().catch(() => ({}));
  if (!tokenFormaOk(b?.t)) return json({ ok: false, error: 'El link no es válido. Pedí uno nuevo.' }, 400);
  try {
    const sql = getSql();
    await ensurePerfil(sql);
    const a = await canjearAcceso(sql, b.t);
    if (!a) return json({ ok: false, error: 'Este link ya se usó o venció. Pedí uno nuevo.' }, 410);
    await crearSesion(sql, cookies, a.pacienteId);
    return json({ ok: true, ir: rutaDestino(a.destino) });
  } catch (err) {
    console.error('cuenta/entrar', err);
    return json({ ok: false, error: 'No pudimos abrir tu cuenta. Probá de nuevo.' }, 500);
  }
};
