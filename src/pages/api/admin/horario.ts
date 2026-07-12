import type { APIRoute } from 'astro';
import { getSql, ensureFranjas } from '../../../lib/db';
import { sedeKeyDeSlug } from '../../../lib/agenda';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const SLUGS = ['montevideo', 'san-jose', 'online'];

// POST /api/admin/horario
// body: { sede, dias: [{ fecha:'YYYY-MM-DD', horas:['HH:MM',...], duracion:int }] }
// Reemplaza la disponibilidad FUTURA de ESA sede (no toca las otras sedes ni el
// pasado ni las reservas). Un día sin horas queda cerrado.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const sede: string = body?.sede;
  if (!SLUGS.includes(sede)) return json({ ok: false, error: 'Sede inválida' }, 400);

  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const esFecha = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= hoy;
  const esHora = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  const esDur = (v: unknown) => Number.isInteger(v) && (v as number) >= 5 && (v as number) <= 240;

  const diasIn: any[] = Array.isArray(body?.dias) ? body.dias : [];
  const dias = diasIn
    .filter((d) => d && esFecha(d.fecha) && Array.isArray(d.horas))
    .map((d) => ({
      fecha: d.fecha as string,
      horas: [...new Set((d.horas as any[]).filter((h) => esHora(h)))] as string[],
      duracion: esDur(d.duracion) ? (d.duracion as number) : 30,
    }))
    .filter((d) => d.horas.length > 0);

  try {
    const sql = getSql();
    await ensureFranjas(sql);

    let sedeId: string | null = null;
    if (sede !== 'online') {
      const nombre = sede === 'montevideo' ? 'Montevideo' : 'San José';
      const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
      sedeId = r[0]?.id ? String(r[0].id) : null;
      if (!sedeId) return json({ ok: false, error: 'Sede no encontrada' }, 400);
    }

    // Reemplazo transaccional de la disponibilidad futura de esta sede.
    const queries: any[] = [];
    if (sedeId) queries.push(sql`delete from franjas where sede_id = ${sedeId} and fecha >= ${hoy}`);
    else queries.push(sql`delete from franjas where sede_id is null and fecha >= ${hoy}`);

    let turnos = 0;
    for (const d of dias) {
      for (const h of d.horas) {
        queries.push(
          sql`insert into franjas (sede_id, fecha, hora, duracion_min) values (${sedeId}, ${d.fecha}, ${h}, ${d.duracion})`
        );
        turnos++;
      }
    }
    await sql.transaction(queries);
    return json({ ok: true, sede, dias: dias.length, turnos });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/admin/horario:', msg);
    return json({ ok: false, error: 'No se pudo guardar la disponibilidad. Probá de nuevo.', detalle: msg }, 500);
  }
};

// GET /api/admin/horario?sede=...  → la disponibilidad futura de esa sede, con
// las reservas ya tomadas (para pintar el calendario del panel).
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const sede = url.searchParams.get('sede') || 'online';
  if (!SLUGS.includes(sede)) return json({ ok: false, error: 'Sede inválida' }, 400);
  try {
    const sql = getSql();
    await ensureFranjas(sql);
    const sedeKey = await sedeKeyDeSlug(sql, sede);
    const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

    const franjas = (await sql`
      select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora, duracion_min as duracion
      from franjas
      where coalesce(sede_id::text, 'online') = ${sedeKey} and fecha >= ${hoy}
      order by fecha, hora
    `) as any[];

    const reservas = (await sql`
      select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora, nombre, estado
      from reservas
      where coalesce(sede_id::text, 'online') = ${sedeKey} and fecha >= ${hoy}
        and (estado = 'confirmada' or (estado = 'pendiente_pago' and (expira_at is null or expira_at > now())))
      order by fecha, hora
    `) as any[];

    return json({ ok: true, sede, franjas, reservas });
  } catch (e) {
    console.error('GET /api/admin/horario:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo cargar la disponibilidad.' }, 500);
  }
};
