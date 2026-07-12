import type { APIRoute } from 'astro';
import { getSql, ensureFranjas, ensureConfirmacion } from '../../lib/db';
import { ahoraUY, labelFecha, sedeKeyDeSlug } from '../../lib/agenda';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// GET /api/disponibilidad?sede=montevideo|san-jose|online
// Turnos que Ceci abrió (franjas) de hoy en adelante, sin los ya reservados
// (web o manual) ni las horas de hoy que ya pasaron.
export const GET: APIRoute = async ({ url }) => {
  const sede = url.searchParams.get('sede') || 'online';
  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureConfirmacion(sql);
    const sedeKey = await sedeKeyDeSlug(sql, sede);
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

    const slots = [...porFecha.entries()]
      .filter(([, horas]) => horas.length)
      .map(([fecha, horas]) => ({ fecha, label: labelFecha(fecha), horas }));

    return json({ ok: true, sede, slots, llenas: [] });
  } catch (e) {
    console.error('GET /api/disponibilidad:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos cargar la disponibilidad.' }, 500);
  }
};
