/**
 * Generación de turnos desde el HORARIO SEMANAL recurrente.
 * =========================================================
 * Ceci define su semana típica (tabla horario_semanal). Los turnos concretos
 * de cada fecha se generan acá, en un solo lugar, para que la disponibilidad
 * pública (src/pages/api/disponibilidad.ts) y la validación al reservar
 * (src/pages/api/reservar.ts) usen exactamente la misma lógica.
 */

import { ensureHorarioSemanal } from './db';

/** Cuántos días hacia adelante se abren turnos (10 semanas). */
export const DIAS_ADELANTE = 70;

/** "Hoy" y "ahora" en hora de Uruguay (UTC-3); el runtime corre en UTC. */
export function ahoraUY() {
  const iso = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
  return { hoy: iso.slice(0, 10), hora: iso.slice(11, 16) };
}

/** Día de la semana (0=domingo … 6=sábado) de una fecha YYYY-MM-DD. */
export function diaSemana(fechaIso: string): number {
  const [y, m, d] = fechaIso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Suma un día a una fecha YYYY-MM-DD (sin problemas de zona horaria). */
export function sumarDia(fechaIso: string): string {
  const [y, m, d] = fechaIso.split('-').map(Number);
  const nx = new Date(Date.UTC(y, m - 1, d + 1));
  return nx.toISOString().slice(0, 10);
}

export type Bloque = { dia_semana: number; hora_desde: string; hora_hasta: string; duracion_min: number };

/** Genera las horas de inicio de un rango [desde, hasta) cada `duracion` min. */
function horasDeBloque(b: { hora_desde: string; hora_hasta: string; duracion_min: number }): { hora: string; duracionMin: number }[] {
  const [dh, dm] = b.hora_desde.slice(0, 5).split(':').map(Number);
  const [hh, hm] = b.hora_hasta.slice(0, 5).split(':').map(Number);
  const fin = hh * 60 + hm;
  const dur = Number(b.duracion_min) || 30;
  const out: { hora: string; duracionMin: number }[] = [];
  for (let t = dh * 60 + dm; t + dur <= fin; t += dur) {
    out.push({
      hora: `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`,
      duracionMin: dur,
    });
  }
  return out;
}

/**
 * Turnos de una fecha a partir de bloques YA cargados en memoria (sin tocar la
 * DB). `bloqueada` = la fecha está marcada como "no atiende". Se usa en el bucle
 * de disponibilidad para no hacer una query por día.
 */
export function turnosDeFechaMem(
  bloques: Bloque[],
  fechaIso: string,
  bloqueada: boolean
): { hora: string; duracionMin: number }[] {
  if (bloqueada) return [];
  const dow = diaSemana(fechaIso);
  const vistos = new Set<string>();
  const out: { hora: string; duracionMin: number }[] = [];
  for (const b of bloques) {
    if (b.dia_semana !== dow) continue;
    for (const h of horasDeBloque(b)) {
      if (vistos.has(h.hora)) continue; // rangos superpuestos: una sola vez
      vistos.add(h.hora);
      out.push(h);
    }
  }
  return out;
}

/** Carga todos los bloques del horario semanal de una sede (una query). */
export async function cargarBloques(sql: any, sedeKey: string): Promise<Bloque[]> {
  return (await sql`
    select dia_semana,
           to_char(hora_desde, 'HH24:MI') as hora_desde,
           to_char(hora_hasta, 'HH24:MI') as hora_hasta,
           duracion_min
    from horario_semanal
    where coalesce(sede_id::text, 'online') = ${sedeKey}
    order by dia_semana, hora_desde
  `) as Bloque[];
}

/**
 * Turnos que Ceci ofrece en UNA fecha y sede (consulta puntual, para validar al
 * reservar). Devuelve [] si la fecha está bloqueada o no hay horario ese día.
 */
export async function turnosDeFecha(
  sql: any,
  sedeKey: string,
  fechaIso: string
): Promise<{ hora: string; duracionMin: number }[]> {
  const blo = await sql`select 1 from bloqueos where fecha = ${fechaIso} limit 1`;
  if (blo.length) return [];
  const bloques = await cargarBloques(sql, sedeKey);
  return turnosDeFechaMem(bloques, fechaIso, false);
}

/**
 * La duración de un turno puntual (para copiarla a la reserva y al evento de
 * Calendar). Devuelve null si esa hora no existe en el horario de esa fecha.
 */
export async function duracionDeTurno(
  sql: any,
  sedeKey: string,
  fechaIso: string,
  hora: string
): Promise<number | null> {
  const turnos = await turnosDeFecha(sql, sedeKey, fechaIso);
  const t = turnos.find((x) => x.hora === hora);
  return t ? t.duracionMin : null;
}

export { ensureHorarioSemanal };
