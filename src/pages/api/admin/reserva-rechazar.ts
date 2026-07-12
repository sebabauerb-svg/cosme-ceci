import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { borrarEventoReserva } from '../../../lib/calendar';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// POST /api/admin/reserva-rechazar  { id }
// Ceci rechaza una reserva 'a_confirmar' (o de pago pendiente) desde el panel:
// pasa a 'cancelada' (libera el cupo) y borra el evento de Calendar si tenía.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Cuerpo inválido' }, 400); }
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return json({ ok: false, error: 'Falta id' }, 400);

  try {
    const sql = getSql();
    await ensureConfirmacion(sql);
    let eventId: string | null = null;
    try {
      const r = (await sql`select google_event_id from reservas where id = ${id}`) as any[];
      eventId = r[0]?.google_event_id ?? null;
    } catch {
      /* columna aún no migrada: no hay evento que borrar */
    }
    const upd = (await sql`
      update reservas set estado = 'cancelada'
      where id = ${id} and estado in ('a_confirmar', 'pendiente_pago')
      returning id
    `) as any[];
    if (!upd.length)
      return json({ ok: false, error: 'Esa reserva ya no se puede rechazar (ya se resolvió).' }, 409);
    if (eventId) await borrarEventoReserva(eventId);
    return json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/reserva-rechazar:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo rechazar la reserva.' }, 500);
  }
};
