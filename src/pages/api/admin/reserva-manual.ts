import type { APIRoute } from 'astro';
import { getSql, ensureFranjas } from '../../../lib/db';
import { sedeKeyDeSlug } from '../../../lib/agenda';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const SLUGS = ['montevideo', 'san-jose', 'online'];

async function sedeId(sql: any, sede: string): Promise<string | null> {
  if (sede === 'online') return null;
  const nombre = sede === 'montevideo' ? 'Montevideo' : 'San José';
  const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
  return r[0]?.id ? String(r[0].id) : null;
}

// POST /api/admin/reserva-manual  { sede, fecha, hora, nombre }
// Marca un turno como reservado por fuera de la web (ej. WhatsApp). Ocupa el
// cupo con una reserva 'confirmada' sin pago. Modalidad 'manual' para distinguirla.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }
  const { sede, fecha, hora } = body ?? {};
  const nombre = typeof body?.nombre === 'string' ? body.nombre.trim() : '';
  if (!SLUGS.includes(sede)) return json({ ok: false, error: 'Sede inválida' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora))
    return json({ ok: false, error: 'Fecha u hora inválida' }, 400);
  if (nombre.length < 1 || nombre.length > 120) return json({ ok: false, error: 'Poné un nombre' }, 400);

  try {
    const sql = getSql();
    const sid = await sedeId(sql, sede);
    try {
      await sql`
        insert into reservas (modalidad, sede_id, fecha, hora, nombre, telefono, estado)
        values ('manual', ${sid}, ${fecha}, ${hora}, ${nombre}, '—', 'confirmada')
      `;
    } catch (e: any) {
      if (e?.code === '23505' || String(e?.message ?? e).includes('reservas_slot_unico'))
        return json({ ok: false, error: 'Ese turno ya está ocupado.' }, 409);
      throw e;
    }
    return json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/admin/reserva-manual:', msg);
    return json({ ok: false, error: 'No se pudo marcar el turno.', detalle: msg }, 500);
  }
};

// DELETE /api/admin/reserva-manual?sede=&fecha=&hora=  → libera un turno que se
// había marcado manualmente (solo borra reservas 'manual', nunca las pagadas).
export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const sede = url.searchParams.get('sede') || '';
  const fecha = url.searchParams.get('fecha') || '';
  const hora = url.searchParams.get('hora') || '';
  if (!SLUGS.includes(sede)) return json({ ok: false, error: 'Sede inválida' }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora))
    return json({ ok: false, error: 'Fecha u hora inválida' }, 400);
  try {
    const sql = getSql();
    await ensureFranjas(sql);
    const sedeKey = await sedeKeyDeSlug(sql, sede);
    await sql`
      delete from reservas
      where coalesce(sede_id::text, 'online') = ${sedeKey}
        and fecha = ${fecha} and hora = ${hora} and modalidad = 'manual'
    `;
    return json({ ok: true });
  } catch (e) {
    console.error('DELETE /api/admin/reserva-manual:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo liberar el turno.' }, 500);
  }
};
