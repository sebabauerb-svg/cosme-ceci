import type { APIRoute } from 'astro';
import { getSql, ensureFranjas } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function nombreSede(slug: string) {
  if (slug === 'montevideo') return 'Montevideo';
  if (slug === 'san-jose') return 'San José';
  return null; // online
}

// POST /api/admin/disponibilidad  body: { lugar, fechas: ['YYYY-MM-DD'], horas: ['HH:MM'] }
// Reemplaza las franjas FUTURAS de ese lugar por (fechas × horas).
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const lugar: string = body?.lugar;
  const fechas: string[] = Array.isArray(body?.fechas) ? body.fechas : [];
  const horas: string[] = Array.isArray(body?.horas) ? body.horas : [];
  if (!['montevideo', 'san-jose', 'online'].includes(lugar)) {
    return json({ ok: false, error: 'Lugar inválido' }, 400);
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const fechasOk = fechas.filter((f) => /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= hoy);
  const horasOk = horas.filter((h) => /^\d{2}:\d{2}$/.test(h));

  try {
    const sql = getSql();
    await ensureFranjas(sql);

    let sedeId: string | null = null;
    const nombre = nombreSede(lugar);
    if (nombre) {
      const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
      sedeId = r[0]?.id ? String(r[0].id) : null;
    }

    // Borrar las franjas futuras de ese lugar (no tocamos el pasado)
    if (sedeId) {
      await sql`delete from franjas where sede_id = ${sedeId} and fecha >= ${hoy}`;
    } else {
      await sql`delete from franjas where sede_id is null and fecha >= ${hoy}`;
    }

    // Insertar fechas × horas
    let guardados = 0;
    for (const f of fechasOk) {
      for (const h of horasOk) {
        await sql`insert into franjas (sede_id, fecha, hora) values (${sedeId}, ${f}, ${h})`;
        guardados++;
      }
    }

    // Días marcados "llenos" → bloqueos
    const llenasOk = (Array.isArray(body?.llenas) ? body.llenas : []).filter(
      (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= hoy
    );
    if (sedeId) await sql`delete from bloqueos where sede_id = ${sedeId} and fecha >= ${hoy}`;
    else await sql`delete from bloqueos where sede_id is null and fecha >= ${hoy}`;
    for (const f of llenasOk) {
      await sql`insert into bloqueos (sede_id, fecha, motivo) values (${sedeId}, ${f}, 'lleno')`;
    }

    return json({ ok: true, lugar, fechas: fechasOk.length, horas: horasOk.length, llenas: llenasOk.length, guardados });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
