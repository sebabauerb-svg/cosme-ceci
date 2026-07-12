import type { APIRoute } from 'astro';
import { getSql } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { borrarEventoReserva } from '../../../lib/calendar';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// DELETE /api/admin/reserva?id=...  → borra una reserva (libera el cupo)
// y, si tenía evento en el Google Calendar de Ceci, lo borra también.
export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ ok: false, error: 'Falta id' }, 400);
  try {
    const sql = getSql();
    let eventId: string | null = null;
    try {
      const r = (await sql`select google_event_id from reservas where id = ${id}`) as any[];
      eventId = r[0]?.google_event_id ?? null;
    } catch {
      /* columna aún no migrada: no hay evento que borrar */
    }
    await sql`delete from reservas where id = ${id}`;
    if (eventId) await borrarEventoReserva(eventId);
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/admin/reserva:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo borrar la reserva.' }, 500);
  }
};
