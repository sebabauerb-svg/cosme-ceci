import type { APIRoute } from 'astro';
import { getSql } from '../../lib/db';
import { notificarReserva } from '../../lib/email';
import { crearPreferencia, mpConfigurado } from '../../lib/mercadopago';
import { precioOnline } from '../../lib/precios';

export const prerender = false;

const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  club: 'Club de las Estaciones',
};

function labelFecha(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-UY', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function nombreSede(slug: string | null) {
  if (slug === 'montevideo') return 'Montevideo';
  if (slug === 'san-jose') return 'San José';
  return null;
}

// POST /api/reservar  → crea la reserva (pendiente_pago) y BLOQUEA el cupo.
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const { modalidad, sede, fecha, hora, nombre, telefono, email } = body ?? {};
  if (!modalidad || !nombre || !telefono) {
    return json({ ok: false, error: 'Faltan datos obligatorios' }, 400);
  }

  const esMembresia = modalidad === 'club';
  if (!esMembresia && (!fecha || !hora)) {
    return json({ ok: false, error: 'Falta fecha u hora' }, 400);
  }

  // Validación de formato y límites. Neon usa placeholders (no hay SQL injection),
  // pero validamos igual para no guardar datos corruptos ni fechas pasadas.
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const nombreT = str(nombre);
  const telT = str(telefono);
  const emailT = str(email);
  if (!(modalidad in NOMBRE_MODALIDAD)) return json({ ok: false, error: 'Modalidad inválida' }, 400);
  if (nombreT.length < 2 || nombreT.length > 120) return json({ ok: false, error: 'Nombre inválido' }, 400);
  if (telT.length < 5 || telT.length > 40) return json({ ok: false, error: 'Teléfono inválido' }, 400);
  if (emailT && (emailT.length > 160 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailT)))
    return json({ ok: false, error: 'Email inválido' }, 400);
  if (!esMembresia) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return json({ ok: false, error: 'Fecha inválida' }, 400);
    if (!/^\d{2}:\d{2}$/.test(hora)) return json({ ok: false, error: 'Hora inválida' }, 400);
    // Fecha de hoy en Uruguay (UTC-3): no permitimos reservar en el pasado.
    const hoyUY = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    if (fecha < hoyUY) return json({ ok: false, error: 'La fecha ya pasó' }, 400);
  }

  // El monto lo fija el servidor según la modalidad. NUNCA se toma del cliente
  // (el body podría venir manipulado con precio: 1). Ver src/lib/precios.ts.
  const precioNum = precioOnline(modalidad);
  const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min para pagar

  try {
    const sql = getSql();

    // Liberar cupos de reservas pendientes vencidas (auto-expiración, sin cron)
    await sql`
      update reservas set estado = 'expirada'
      where estado = 'pendiente_pago' and expira_at is not null and expira_at < now()
    `;

    let sedeId: string | null = null;
    const nombreS = nombreSede(sede);
    if (nombreS) {
      const r = await sql`select id from sedes where nombre = ${nombreS} limit 1`;
      sedeId = r[0]?.id ? String(r[0].id) : null;
    }

    try {
      const ins = await sql`
        insert into reservas
          (modalidad, sede_id, fecha, hora, nombre, telefono, email, precio_uyu, estado, expira_at)
        values
          (${modalidad}, ${sedeId}, ${esMembresia ? null : fecha}, ${esMembresia ? null : hora},
           ${nombreT}, ${telT}, ${emailT || null}, ${precioNum}, 'pendiente_pago', ${expira})
        returning id
      `;
      const reservaId = String(ins[0].id);

      // Aviso por email a Ceci y a la clienta (no bloquea la reserva)
      await notificarReserva({
        modalidad: NOMBRE_MODALIDAD[modalidad] ?? modalidad,
        sede: nombreS,
        fechaLabel: esMembresia ? null : labelFecha(fecha),
        hora: esMembresia ? null : hora,
        nombre: nombreT,
        telefono: telT,
        email: emailT || null,
      });

      // Pago online con MercadoPago (si está configurado y hay monto).
      // Si falla o no está configurado, devolvemos sin initPoint → la web cae al flujo manual.
      let initPoint: string | null = null;
      if (mpConfigurado() && precioNum) {
        try {
          const origin = new URL(request.url).origin;
          const tituloItem = [
            NOMBRE_MODALIDAD[modalidad] ?? modalidad,
            nombreS,
            esMembresia ? null : labelFecha(fecha),
            esMembresia ? null : hora ? `${hora} h` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const pref = await crearPreferencia({
            titulo: tituloItem,
            precio: precioNum,
            reservaId,
            origin,
            email: emailT || null,
          });
          initPoint = pref.initPoint;
          await sql`update reservas set mp_preference_id = ${pref.id} where id = ${reservaId}`;
        } catch (e) {
          console.error('MP preferencia:', e instanceof Error ? e.message : e);
        }
      }

      return json({ ok: true, id: reservaId, initPoint });
    } catch (e: any) {
      // 23505 = unique_violation → el cupo ya fue tomado entre que eligió y confirmó
      if (e?.code === '23505' || String(e?.message ?? e).includes('reservas_slot_unico')) {
        return json(
          { ok: false, code: 'SLOT_TOMADO', error: 'Ese horario se ocupó recién. Elegí otro.' },
          409
        );
      }
      throw e;
    }
  } catch (e) {
    // Log completo del lado servidor; al cliente solo un mensaje genérico
    // (no exponemos detalles de la base de datos ni del stack).
    console.error('POST /api/reservar:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos registrar la reserva. Probá de nuevo.' }, 500);
  }
};
