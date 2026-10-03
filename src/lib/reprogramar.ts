/**
 * MOVER UN TURNO
 * ==============
 * Lo usan los dos caminos de reprogramación:
 *  - Ceci desde el panel (ej. se le cae un día entero y pasa todo a la semana
 *    siguiente): puede mover a cualquier sede y, si hace falta, a un horario que
 *    no tenía abierto.
 *  - La paciente desde el link de su mail (/mi-turno): solo a un turno abierto
 *    y libre de su misma sede, hasta 24 h antes, con un tope de cambios.
 *
 * El turno sigue siendo la MISMA reserva (misma seña, mismo cobro, mismo
 * código): solo cambian fecha, hora y lugar. El cupo nuevo lo protege el índice
 * único de reservas, así que dos personas no pueden quedarse con el mismo.
 */

import { ensureGoogleEventId } from './db';
import { ahoraUY, duracionDeTurno } from './agenda';
import { crearEventoReserva, borrarEventoReserva } from './calendar';
import { sedeConDireccion } from '../data/sedes';

export const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  club: 'Club de las Estaciones',
  manual: 'Reserva manual',
};

/** Cuántas veces puede reprogramar sola una paciente el mismo turno. */
export const MAX_CAMBIOS_PACIENTE = 2;
/** Igual que la política de cancelación: los cambios, con 24 h de anticipación. */
export const ANTICIPACION_MIN_H = 24;

/** Dominio público del sitio, para armar links que salen por mail o WhatsApp. */
export function urlSitio(): string {
  const u = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || 'https://cgcosmetologiamedica.com';
  return u.replace(/\/+$/, '');
}

/** Link "cambiar mi horario" de una reserva, o null si no tiene código. */
export function linkAutogestion(token?: string | null): string | null {
  return token ? `${urlSitio()}/mi-turno?c=${token}` : null;
}

/** Horas que faltan para un turno (fecha y hora de Uruguay, UTC-3). */
export function horasHasta(fecha: string, hora: string): number {
  return (Date.parse(`${fecha}T${hora}:00-03:00`) - Date.now()) / 3600000;
}

/** 'sábado 15 de agosto' — la fecha como la escribe Ceci. */
export function fechaLarga(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-UY', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

export type TurnoMovido = {
  id: string;
  modalidad: string;
  nombreModalidad: string;
  sede: string | null;
  fecha: string;
  hora: string;
  nombre: string;
  telefono: string;
  email: string | null;
  token: string | null;
  antes: { fecha: string; hora: string; sede: string | null };
};

export type ResultadoMover =
  | { ok: true; turno: TurnoMovido }
  | { ok: false; status: number; error: string; code?: string };

const falla = (status: number, error: string, code?: string): ResultadoMover => ({ ok: false, status, error, code });

/**
 * Mueve una reserva CONFIRMADA a otro día/hora/lugar. No manda avisos: eso lo
 * decide quien llama (Ceci elige si avisar; la paciente siempre recibe el mail).
 *
 * sedeKey: uuid de la sede física o 'online' (ver sedeKeyDeSlug).
 * opts.libre: Ceci mueve a un horario que no abrió en la agenda.
 * opts.cerrarAnterior: el horario que se libera deja de ofrecerse (Ceci mueve
 *   porque ese día no atiende: no queremos que otra paciente lo reserve).
 * opts.porPaciente: suma al contador de cambios de la paciente.
 */
export async function moverReserva(
  sql: any,
  id: string,
  destino: { fecha: string; hora: string; sedeKey: string },
  opts: { libre?: boolean; cerrarAnterior?: boolean; porPaciente?: boolean } = {}
): Promise<ResultadoMover> {
  const { fecha, hora, sedeKey } = destino;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return falla(400, 'Fecha u hora inválida.');
  const { hoy, hora: ahora } = ahoraUY();
  if (fecha < hoy || (fecha === hoy && hora <= ahora)) return falla(400, 'Ese horario ya pasó.');

  const rows = (await sql`
    select r.id, r.estado, r.modalidad, coalesce(r.sede_id::text, 'online') as sede_key,
           coalesce(s.nombre, '') as sede, r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora,
           r.nombre, r.telefono, r.email, r.duracion_min, r.google_event_id, r.token_gestion
      from reservas r left join sedes s on s.id = r.sede_id
     where r.id = ${id}
  `) as any[];
  const r = rows[0];
  if (!r) return falla(404, 'No encontramos ese turno.');
  if (r.estado !== 'confirmada' || !r.fecha || !r.hora)
    return falla(409, 'Solo se pueden mover turnos confirmados con día y hora.');
  if (r.fecha === fecha && r.hora === hora && r.sede_key === sedeKey) return falla(400, 'Es el mismo horario que ya tiene.');

  // Una consulta presencial necesita sede física y una online no puede caer en
  // una sede: si no, ocuparía el cupo equivocado. Las manuales van a cualquiera.
  if (r.modalidad === 'presencial' && sedeKey === 'online') return falla(400, 'Una consulta presencial necesita sede.');
  if ((r.modalidad === 'virtual' || r.modalidad === 'skincare-inteligente') && sedeKey !== 'online')
    return falla(400, 'Una consulta online no va en una sede.');

  let duracion = await duracionDeTurno(sql, sedeKey, fecha, hora);
  if (duracion == null) {
    if (!opts.libre) return falla(409, 'Ese horario no está disponible. Elegí otro.', 'SLOT_TOMADO');
    duracion = r.duracion_min != null ? Number(r.duracion_min) : 30;
  }

  const sedeId = sedeKey === 'online' ? null : sedeKey;
  let upd: any[];
  try {
    // Se filtra por la fecha/hora de origen: si dos pestañas mueven el mismo
    // turno a la vez, la segunda no pisa a la primera.
    upd = await sql`
      update reservas
         set fecha = ${fecha}, hora = ${hora}, sede_id = ${sedeId}, duracion_min = ${duracion},
             recordatorio_at = null,
             cambios_paciente = cambios_paciente + ${opts.porPaciente ? 1 : 0}
       where id = ${id} and estado = 'confirmada' and fecha = ${r.fecha} and hora = ${r.hora}
       returning id
    `;
  } catch (e: any) {
    if (e?.code === '23505' || String(e?.message ?? e).includes('reservas_slot_unico'))
      return falla(409, 'Ese horario lo acaba de tomar otra persona. Elegí otro.', 'SLOT_TOMADO');
    throw e;
  }
  if (!upd.length) return falla(409, 'El turno cambió mientras tanto. Recargá y probá de nuevo.');

  if (opts.cerrarAnterior) {
    await sql`
      delete from franjas
       where coalesce(sede_id::text, 'online') = ${r.sede_key} and fecha = ${r.fecha} and hora = ${r.hora}
    `;
  }

  let sedeNueva: string | null = null;
  if (sedeId) {
    const s = (await sql`select nombre from sedes where id = ${sedeId} limit 1`) as any[];
    sedeNueva = s[0]?.nombre ?? null;
  }
  const nombreModalidad = NOMBRE_MODALIDAD[r.modalidad] ?? r.modalidad;

  // Google Calendar: el evento viejo se borra y se crea uno nuevo. Solo si ya
  // tenía evento (las reservas manuales nunca lo tuvieron y no lo inventamos).
  if (r.google_event_id) {
    await borrarEventoReserva(r.google_event_id);
    const ev = await crearEventoReserva({
      resumen: `${nombreModalidad} — ${r.nombre}`,
      descripcion: [
        `Servicio: ${nombreModalidad}`,
        sedeNueva ? `Sede: ${sedeConDireccion(sedeNueva)}` : 'Online',
        `Cliente: ${r.nombre}`,
        `WhatsApp: ${r.telefono}`,
        r.email ? `Email: ${r.email}` : '',
        `Reprogramado (antes: ${r.fecha} ${r.hora})`,
      ].filter(Boolean).join('\n'),
      fecha,
      hora,
      duracionMin: duracion,
    });
    try {
      await ensureGoogleEventId(sql);
      await sql`update reservas set google_event_id = ${ev.ok && ev.eventId ? ev.eventId : null} where id = ${id}`;
    } catch (e) {
      console.error('No se pudo guardar google_event_id:', e instanceof Error ? e.message : e);
    }
  }

  return {
    ok: true,
    turno: {
      id: String(r.id),
      modalidad: r.modalidad,
      nombreModalidad,
      sede: sedeNueva,
      fecha,
      hora,
      nombre: r.nombre,
      telefono: r.telefono,
      email: r.email,
      token: r.token_gestion ?? null,
      antes: { fecha: r.fecha, hora: r.hora, sede: r.sede || null },
    },
  };
}
