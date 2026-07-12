import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// POST /api/admin/reserva-pago  { id, monto_cobrado?, pagado }
// Registra/actualiza el cobro de una reserva ya CONFIRMADA (seguimiento del
// giro/efectivo que se cobra después). No cambia el estado del turno.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Cuerpo inválido' }, 400); }
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return json({ ok: false, error: 'Falta id' }, 400);
  const montoCobrado = body?.monto_cobrado == null || body.monto_cobrado === '' ? null : Number(body.monto_cobrado);
  if (montoCobrado != null && (!Number.isFinite(montoCobrado) || montoCobrado < 0 || montoCobrado > 1_000_000))
    return json({ ok: false, error: 'Monto inválido' }, 400);
  const pagado = body?.pagado === true ? true : body?.pagado === false ? false : null;

  try {
    const sql = getSql();
    await ensureConfirmacion(sql);
    const upd = (await sql`
      update reservas set monto_cobrado = ${montoCobrado}, pagado = ${pagado}
      where id = ${id} and estado = 'confirmada'
      returning id
    `) as any[];
    if (!upd.length) return json({ ok: false, error: 'No se encontró la reserva confirmada.' }, 404);
    return json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/reserva-pago:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo registrar el pago.' }, 500);
  }
};
