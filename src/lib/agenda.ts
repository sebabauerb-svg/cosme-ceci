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

/**
 * Turnos libres de una sede, de ahora en adelante, agrupados por día: los que
 * Ceci abrió (franjas) menos los tomados por una reserva vigente. Es lo que ve
 * la paciente al reservar y al reprogramar, y lo que le ofrece el panel a Ceci
 * para mover un turno. Requiere ensureFranjas + ensureConfirmacion antes.
 */
export async function turnosLibres(
  sql: any,
  sedeKey: string
): Promise<Array<{ fecha: string; label: string; horas: string[] }>> {
  const { hoy, hora: ahora } = ahoraUY();

  const franjas = (await sql`
    select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora
    from franjas
    where coalesce(sede_id::text, 'online') = ${sedeKey} and fecha >= ${hoy}
    order by fecha, hora
  `) as { fecha: string; hora: string }[];

  const ocupadas = (await sql`
    select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora
    from reservas
    where (estado = 'confirmada'
           or (estado in ('pendiente_pago','a_confirmar') and (expira_at is null or expira_at > now())))
      and fecha >= ${hoy}
      and coalesce(sede_id::text, 'online') = ${sedeKey}
  `) as { fecha: string; hora: string }[];
  const tomadas = new Set(ocupadas.map((o) => `${o.fecha} ${o.hora}`));

  const porFecha = new Map<string, string[]>();
  for (const f of franjas) {
    if (tomadas.has(`${f.fecha} ${f.hora}`)) continue;
    if (f.fecha === hoy && f.hora <= ahora) continue; // hora de hoy ya pasada
    const arr = porFecha.get(f.fecha) ?? [];
    arr.push(f.hora);
    porFecha.set(f.fecha, arr);
  }

  return [...porFecha.entries()]
    .filter(([, horas]) => horas.length)
    .map(([fecha, horas]) => ({ fecha, label: labelFecha(fecha), horas }));
}

export { ensureFranjas, ensureDuracionMin };
