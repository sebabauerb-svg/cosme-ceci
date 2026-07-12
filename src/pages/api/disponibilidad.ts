import type { APIRoute } from 'astro';
import { getSql, ensureFranjas } from '../../lib/db';

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
  return null;
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
export const GET: APIRoute = async ({ url }) => {
  const sede = url.searchParams.get('sede') || 'online';
  try {
    const sql = getSql();
    await ensureFranjas(sql);

    let sedeKey = 'online';
    const nombre = nombreSede(sede);
    if (nombre) {
      const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
      sedeKey = r[0]?.id ? String(r[0].id) : 'online';
    }

    // "Hoy" y "ahora" en hora de Uruguay (UTC-3): el runtime corre en UTC y sin
    // el offset los slots del día desaparecen 3 horas antes de medianoche.
    const ahoraUYiso = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const hoy = ahoraUYiso.slice(0, 10);
    const ahoraUY = ahoraUYiso.slice(11, 16);

    // Franjas configuradas por Ceci (desde hoy en adelante)
    const franjas = await sql`
      select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora
      from franjas
      where coalesce(sede_id::text, 'online') = ${sedeKey} and fecha >= ${hoy}
      order by fecha, hora
    `;

    // Turnos ya tomados
    const ocupadas = await sql`
      select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora
      from reservas
      where (estado = 'confirmada'
             or (estado = 'pendiente_pago' and (expira_at is null or expira_at > now())))
        and fecha >= ${hoy}
        and coalesce(sede_id::text, 'online') = ${sedeKey}
    `;
    const tomadas = new Set((ocupadas as any[]).map((o) => `${o.fecha} ${o.hora}`));

    // Fechas bloqueadas de esta sede. sede_id null = sede Online (misma convención
    // que franjas y reservas); un bloqueo de Online no debe tapar Montevideo/San José.
    const blo = await sql`
      select fecha::text as fecha from bloqueos
      where fecha >= ${hoy} and coalesce(sede_id::text, 'online') = ${sedeKey}
    `;
    const bloqueadas = new Set((blo as any[]).map((b) => b.fecha));

    // Fechas que Ceci configuró para esta sede
    const configuradas = new Set((franjas as any[]).map((f) => f.fecha));

    // Agrupar las horas libres por fecha
    const porFecha = new Map<string, string[]>();
    for (const f of franjas as any[]) {
      if (bloqueadas.has(f.fecha)) continue;
      if (tomadas.has(`${f.fecha} ${f.hora}`)) continue;
      if (f.fecha === hoy && f.hora <= ahoraUY) continue; // hora de hoy ya pasada
      const arr = porFecha.get(f.fecha) ?? [];
      arr.push(f.hora);
      porFecha.set(f.fecha, arr);
    }

    const slots = [...porFecha.entries()]
      .map(([fecha, horas]) => ({ fecha, label: label(fecha), horas }))
      .filter((d) => d.horas.length > 0);

    // Fechas "llenas": configuradas sin cupo libre + bloqueadas manualmente por Ceci
    const disponibles = new Set(slots.map((s) => s.fecha));
    const llenasSet = new Set([...configuradas].filter((f) => !disponibles.has(f)));
    bloqueadas.forEach((f) => llenasSet.add(f));
    const llenas = [...llenasSet].sort();

    return json({ ok: true, sede, slots, llenas });
  } catch (e) {
    console.error('GET /api/disponibilidad:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos cargar la disponibilidad.' }, 500);
  }
};
