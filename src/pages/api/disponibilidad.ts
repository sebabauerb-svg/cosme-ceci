import type { APIRoute } from 'astro';
import { getSql } from '../../lib/db';
import {
  turnosDeFechaMem,
  cargarBloques,
  ensureHorarioSemanal,
  ahoraUY,
  sumarDia,
  DIAS_ADELANTE,
} from '../../lib/agenda';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function nombreSede(slug: string | null) {
  if (slug === 'montevideo') return 'Montevideo';
  if (slug === 'san-jose') return 'San José';
  return null; // online
}

function label(iso: string) {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('es-UY', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

// GET /api/disponibilidad?sede=montevideo|san-jose|online
// Genera los turnos de las próximas semanas desde el horario semanal de Ceci,
// descontando los ya reservados y las horas de hoy que ya pasaron.
export const GET: APIRoute = async ({ url }) => {
  const sede = url.searchParams.get('sede') || 'online';
  try {
    const sql = getSql();
    await ensureHorarioSemanal(sql);

    let sedeKey = 'online';
    const nombre = nombreSede(sede);
    if (nombre) {
      const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
      sedeKey = r[0]?.id ? String(r[0].id) : 'online';
    }

    const { hoy, hora: ahora } = ahoraUY();
    let fin = hoy;
    for (let i = 0; i < DIAS_ADELANTE; i++) fin = sumarDia(fin);

    // Todo en 3 queries (no una por día): horario semanal, excepciones y reservas.
    const bloques = await cargarBloques(sql, sedeKey);
    if (!bloques.length) return json({ ok: true, sede, slots: [], llenas: [] });

    const exc = (await sql`
      select fecha::text as fecha from bloqueos where fecha >= ${hoy} and fecha <= ${fin}
    `) as { fecha: string }[];
    const bloqueadas = new Set(exc.map((e) => e.fecha));

    const ocupadas = (await sql`
      select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora
      from reservas
      where (estado = 'confirmada'
             or (estado = 'pendiente_pago' and (expira_at is null or expira_at > now())))
        and fecha >= ${hoy} and fecha <= ${fin}
        and coalesce(sede_id::text, 'online') = ${sedeKey}
    `) as { fecha: string; hora: string }[];
    const tomadas = new Set(ocupadas.map((o) => `${o.fecha} ${o.hora}`));

    const slots: { fecha: string; label: string; horas: string[] }[] = [];
    let fecha = hoy;
    for (let i = 0; i < DIAS_ADELANTE; i++, fecha = sumarDia(fecha)) {
      const turnos = turnosDeFechaMem(bloques, fecha, bloqueadas.has(fecha));
      if (!turnos.length) continue;
      const horas = turnos
        .map((t) => t.hora)
        .filter((h) => !tomadas.has(`${fecha} ${h}`))
        .filter((h) => !(fecha === hoy && h <= ahora)); // hora de hoy ya pasada
      if (horas.length) slots.push({ fecha, label: label(fecha), horas });
    }

    // "llenas": ya no aplica en el modelo semanal (los días sin cupo simplemente
    // no aparecen). Se mantiene el campo vacío por compatibilidad con el front.
    return json({ ok: true, sede, slots, llenas: [] });
  } catch (e) {
    console.error('GET /api/disponibilidad:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos cargar la disponibilidad.' }, 500);
  }
};
