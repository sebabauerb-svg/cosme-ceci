import type { APIRoute } from 'astro';
import { getSql, ensureFranjas, ensureConfirmacion, ensureGestion } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { sedeKeyDeSlug } from '../../../lib/agenda';
import { moverReserva, fechaLarga } from '../../../lib/reprogramar';
import { avisarTurnoMovido } from '../../../lib/avisos';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const SLUGS = ['montevideo', 'san-jose', 'online'];

/**
 * POST /api/admin/reserva-mover
 *   { id, sede, fecha, hora, libre?, cerrarAnterior?, avisar? }
 * Ceci mueve un turno confirmado a otro día/hora (y, si quiere, a otra sede).
 *  - libre: el horario nuevo no estaba abierto en la agenda (lo agenda igual).
 *  - cerrarAnterior: el horario que se libera deja de ofrecerse en la web.
 *  - avisar: le manda el mail "tu turno cambió" a la paciente y, si el
 *    WhatsApp automático está activo, también el WhatsApp.
 * Devuelve el WhatsApp ya escrito por si hay que mandarlo a mano.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Cuerpo inválido' }, 400); }
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return json({ ok: false, error: 'Falta id' }, 400);
  if (!SLUGS.includes(body?.sede)) return json({ ok: false, error: 'Sede inválida' }, 400);

  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureConfirmacion(sql);
    await ensureGestion(sql);

    const sedeKey = await sedeKeyDeSlug(sql, body.sede);
    if (body.sede !== 'online' && sedeKey === 'online') return json({ ok: false, error: 'Sede inválida' }, 400);

    const res = await moverReserva(
      sql,
      id,
      { fecha: String(body.fecha ?? ''), hora: String(body.hora ?? ''), sedeKey },
      { libre: body.libre === true, cerrarAnterior: body.cerrarAnterior === true }
    );
    if (!res.ok) return json({ ok: false, error: res.error, code: res.code }, res.status);
    const t = res.turno;

    const aviso = await avisarTurnoMovido(sql, t, body.avisar === true);

    return json({
      ok: true,
      turno: {
        fecha: t.fecha,
        fechaLarga: fechaLarga(t.fecha),
        hora: t.hora,
        sede: t.sede,
        sedeSlug: body.sede,
      },
      ...aviso,
    });
  } catch (e) {
    console.error('POST /api/admin/reserva-mover:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo mover el turno.' }, 500);
  }
};
