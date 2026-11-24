import type { APIRoute } from 'astro';
import { getSql, ensurePlanesAgenda, ensureFranjas, ensureConfirmacion, ensureGestion } from '../../../lib/db';
import { pacienteActual, perfilActivo } from '../../../lib/cuenta';
import { agendarSesion, motivoNoAgenda, planesDePaciente, SEDES_SESION } from '../../../lib/planes-agenda';
import { sedeKeyDeSlug, turnosLibres } from '../../../lib/agenda';
import { hoyUY } from '../../../lib/pacientes';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function preparar() {
  const sql = getSql();
  await ensureFranjas(sql);
  await ensureConfirmacion(sql);
  await ensureGestion(sql);
  await ensurePlanesAgenda(sql);
  return sql;
}

/**
 * GET /api/cuenta/agendar?plan=<id>&sede=montevideo|san-jose
 * Horarios libres de esa sede (desde mañana) para la próxima sesión del plan.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!perfilActivo()) return json({ ok: false, error: 'No disponible' }, 404);
  const planId = url.searchParams.get('plan') ?? '';
  const sede = SEDES_SESION.find((s) => s.slug === url.searchParams.get('sede'));
  if (!UUID.test(planId) || !sede) return json({ ok: false, error: 'Pedido inválido' }, 400);
  try {
    const sql = await preparar();
    const p = await pacienteActual(sql, cookies);
    if (!p) return json({ ok: false, error: 'Tu sesión venció. Entrá de nuevo.' }, 401);
    const plan = (await planesDePaciente(sql, p.id)).find((x) => x.id === planId);
    if (!plan) return json({ ok: false, error: 'No encontramos ese tratamiento.' }, 404);
    if (!plan.puedeAgendar) return json({ ok: false, error: motivoNoAgenda(plan) }, 409);
    const key = await sedeKeyDeSlug(sql, sede.slug);
    const hoy = hoyUY();
    const slots = key === 'online' ? [] : (await turnosLibres(sql, key)).filter((d) => d.fecha > hoy);
    return json({ ok: true, slots });
  } catch (err) {
    console.error('GET cuenta/agendar', err);
    return json({ ok: false, error: 'No pudimos cargar los horarios.' }, 500);
  }
};

/** POST /api/cuenta/agendar { plan, sede, fecha, hora } → agenda la sesión. */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!perfilActivo()) return json({ ok: false, error: 'No disponible' }, 404);
  const b = await request.json().catch(() => ({}));
  if (typeof b?.plan !== 'string' || !UUID.test(b.plan)) return json({ ok: false, error: 'Pedido inválido' }, 400);
  try {
    const sql = await preparar();
    const p = await pacienteActual(sql, cookies);
    if (!p) return json({ ok: false, error: 'Tu sesión venció. Entrá de nuevo.' }, 401);
    const r = await agendarSesion(sql, p, b.plan, String(b.sede ?? ''), String(b.fecha ?? ''), String(b.hora ?? ''));
    if (!r.ok) return json({ ok: false, error: r.error }, r.status);
    return json(r);
  } catch (err) {
    console.error('POST cuenta/agendar', err);
    return json({ ok: false, error: 'No pudimos agendar. Probá de nuevo.' }, 500);
  }
};
