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

    const hoy = new Date().toISOString().slice(0, 10);

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
      where estado in ('pendiente_pago', 'confirmada')
        and fecha >= ${hoy}
        and coalesce(sede_id::text, 'online') = ${sedeKey}
    `;
    const tomadas = new Set((ocupadas as any[]).map((o) => `${o.fecha} ${o.hora}`));

    // Fechas bloqueadas (de esta sede o globales)
    const blo = await sql`
      select fecha::text as fecha from bloqueos
      where fecha >= ${hoy} and (sede_id is null or coalesce(sede_id::text, '') = ${sedeKey})
    `;
    const bloqueadas = new Set((blo as any[]).map((b) => b.fecha));

    // Agrupar por fecha
    const porFecha = new Map<string, string[]>();
    for (const f of franjas as any[]) {
      if (bloqueadas.has(f.fecha)) continue;
      if (tomadas.has(`${f.fecha} ${f.hora}`)) continue;
      const arr = porFecha.get(f.fecha) ?? [];
      arr.push(f.hora);
      porFecha.set(f.fecha, arr);
    }

    const slots = [...porFecha.entries()]
      .map(([fecha, horas]) => ({ fecha, label: label(fecha), horas }))
      .filter((d) => d.horas.length > 0);

    return json({ ok: true, sede, slots });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
