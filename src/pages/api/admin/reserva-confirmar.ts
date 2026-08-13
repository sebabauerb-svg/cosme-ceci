import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion, ensureGoogleEventId } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { crearEventoReserva } from '../../../lib/calendar';
import { notificarReservaConfirmada } from '../../../lib/email';
import { SENA_UYU } from '../../../lib/precios';
import { sedeConDireccion } from '../../../data/sedes';

export const prerender = false;

const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  club: 'Club de las Estaciones',
  manual: 'Reserva manual',
};

function labelFecha(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-UY', {
      weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
    });
  } catch { return iso; }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// POST /api/admin/reserva-confirmar  { id, monto_cobrado?, pagado? }
// Ceci confirma una reserva 'a_confirmar' desde el panel: queda 'confirmada'
// (cupo firme, igual que un pago online), registra el cobro (monto + pagado sí/no)
// y crea el evento en su Google Calendar.
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
    await ensureGoogleEventId(sql);

    const upd = (await sql`
      update reservas
         set estado = 'confirmada', expira_at = null,
             monto_cobrado = ${montoCobrado}, pagado = ${pagado}
       where id = ${id} and estado = 'a_confirmar'
       returning modalidad, sede_id, fecha::text as fecha, to_char(hora,'HH24:MI') as hora,
                 nombre, telefono, email, duracion_min
    `) as any[];
    if (!upd.length)
      return json({ ok: false, error: 'Esa reserva ya no está a confirmar (quizá venció o ya se resolvió).' }, 409);

    const d = upd[0];
    let sedeNombre: string | null = null;
    if (d.sede_id) {
      const r = (await sql`select nombre from sedes where id = ${d.sede_id} limit 1`) as any[];
      sedeNombre = r[0]?.nombre ?? null;
    }
    const nombreModalidad = NOMBRE_MODALIDAD[d.modalidad] ?? d.modalidad;

    // Aviso por email (confirmada por Ceci, sin pago online). Fire-and-forget.
    void notificarReservaConfirmada(
      {
        modalidad: nombreModalidad,
        sede: sedeNombre,
        fechaLabel: labelFecha(d.fecha),
        hora: d.hora,
        nombre: d.nombre,
        telefono: d.telefono,
        email: d.email,
        // Solo hablamos de seña abonada si Ceci marcó que ya pagó: puede
        // confirmar un turno sin haber visto el pago todavía.
        sena: pagado ? (montoCobrado ?? SENA_UYU) : null,
      },
      { online: false }
    );

    // Evento en el Google Calendar de Ceci (solo turnos con fecha/hora).
    if (d.fecha && d.hora) {
      const duracionMin = d.duracion_min != null ? Number(d.duracion_min) : sedeNombre === 'Montevideo' ? 45 : 30;
      const ev = await crearEventoReserva({
        resumen: `${nombreModalidad} — ${d.nombre}`,
        descripcion: [
          `Servicio: ${nombreModalidad}`,
          sedeNombre ? `Sede: ${sedeConDireccion(sedeNombre)}` : 'Online',
          `Cliente: ${d.nombre}`,
          `WhatsApp: ${d.telefono}`,
          d.email ? `Email: ${d.email}` : '',
        ].filter(Boolean).join('\n'),
        fecha: d.fecha,
        hora: d.hora,
        duracionMin,
      });
      if (ev.ok && ev.eventId) {
        try { await sql`update reservas set google_event_id = ${ev.eventId} where id = ${id}`; }
        catch (e) { console.error('No se pudo guardar google_event_id:', e instanceof Error ? e.message : e); }
      }
    }
    // Devolvemos el detalle para que el panel arme el WhatsApp de confirmación
    // a la paciente (además del email automático que ya salió).
    return json({
      ok: true,
      reserva: {
        nombre: d.nombre,
        telefono: d.telefono,
        modalidad: nombreModalidad,
        sede: sedeNombre,
        fechaLabel: labelFecha(d.fecha),
        hora: d.hora,
      },
    });
  } catch (e) {
    console.error('POST /api/admin/reserva-confirmar:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo confirmar la reserva.' }, 500);
  }
};
