import type { APIRoute } from 'astro';
import { getSql } from '../../../lib/db';
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

// POST /api/admin/disponibilidad  body: { lugar, slots: [{dia, hora}] }
// Reemplaza toda la disponibilidad de ese lugar por la nueva selección.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const lugar: string = body?.lugar;
  const slots: { dia: number; hora: string }[] = Array.isArray(body?.slots) ? body.slots : [];
  if (!['montevideo', 'san-jose', 'online'].includes(lugar)) {
    return json({ ok: false, error: 'Lugar inválido' }, 400);
  }

  try {
    const sql = getSql();
    let sedeId: string | null = null;
    const nombre = nombreSede(lugar);
    if (nombre) {
      const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
      sedeId = r[0]?.id ? String(r[0].id) : null;
    }

    // Borrar lo existente para ese lugar
    if (sedeId) {
      await sql`delete from disponibilidad where sede_id = ${sedeId}`;
    } else {
      await sql`delete from disponibilidad where sede_id is null`;
    }

    // Insertar la nueva selección
    let insertadas = 0;
    for (const s of slots) {
      const dia = Number(s.dia);
      const hora = String(s.hora);
      if (dia < 0 || dia > 6 || !/^\d{2}:\d{2}$/.test(hora)) continue;
      await sql`
        insert into disponibilidad (sede_id, dia_semana, hora)
        values (${sedeId}, ${dia}, ${hora})
        on conflict (sede_id, dia_semana, hora) do nothing
      `;
      insertadas++;
    }

    return json({ ok: true, lugar, guardados: insertadas });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
