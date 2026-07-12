/**
 * Agenda: turnos POR FECHA (tabla franjas).
 * =========================================
 * Ceci abre turnos en fechas concretas (por sede). Cada turno disponible es una
 * fila en `franjas` (sede_id, fecha, hora, duracion_min). La disponibilidad
 * pública y la validación al reservar leen de acá. Un turno se considera libre
 * si existe en franjas y no está tomado por una reserva (web o manual).
 */

import { ensureFranjas, ensureDuracionMin } from './db';

/** "Hoy" y "ahora" en hora de Uruguay (UTC-3); el runtime corre en UTC. */
export function ahoraUY() {
  const iso = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  return { hoy: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/** Etiqueta legible de una fecha YYYY-MM-DD (ej. "lun, 13 jul."). */
export function labelFecha(iso: string) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-UY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/** uuid de la sede física por slug, o 'online' si no aplica. */
export async function sedeKeyDeSlug(sql: any, slug: string | null): Promise<string> {
  const nombre = slug === 'montevideo' ? 'Montevideo' : slug === 'san-jose' ? 'San José' : null;
  if (!nombre) return 'online';
  const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
  return r[0]?.id ? String(r[0].id) : 'online';
}

/**
 * Duración del turno de una franja puntual (para copiarla a la reserva y al
 * evento de Calendar). Devuelve null si esa franja no existe (horario no
 * ofrecido) — sirve también para validar al reservar.
 */
export async function duracionDeTurno(
  sql: any,
  sedeKey: string,
  fechaIso: string,
  hora: string
): Promise<number | null> {
  const r = (await sql`
    select duracion_min from franjas
    where coalesce(sede_id::text, 'online') = ${sedeKey} and fecha = ${fechaIso} and hora = ${hora}
    limit 1
  `) as any[];
  if (!r.length) return null;
  return r[0].duracion_min != null ? Number(r[0].duracion_min) : 30;
}

export { ensureFranjas, ensureDuracionMin };
