import type { APIRoute } from 'astro';
import { getSql } from '../../lib/db';

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

// POST /api/reservar  → crea la reserva (pendiente_pago) y BLOQUEA el cupo.
export const POST: APIRoute = async ({ request }) => {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const { modalidad, sede, fecha, hora, nombre, telefono, email, precio } = body ?? {};
  if (!modalidad || !nombre || !telefono) {
    return json({ ok: false, error: 'Faltan datos obligatorios' }, 400);
  }

  const esMembresia = modalidad === 'club';
  if (!esMembresia && (!fecha || !hora)) {
    return json({ ok: false, error: 'Falta fecha u hora' }, 400);
  }

  const precioNum = precio ? parseInt(String(precio).replace(/[^\d]/g, ''), 10) || null : null;
  const expira = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min para pagar

  try {
    const sql = getSql();

    let sedeId: string | null = null;
    const nombreS = nombreSede(sede);
    if (nombreS) {
      const r = await sql`select id from sedes where nombre = ${nombreS} limit 1`;
      sedeId = r[0]?.id ? String(r[0].id) : null;
    }

    try {
      const ins = await sql`
        insert into reservas
          (modalidad, sede_id, fecha, hora, nombre, telefono, email, precio_uyu, estado, expira_at)
        values
          (${modalidad}, ${sedeId}, ${esMembresia ? null : fecha}, ${esMembresia ? null : hora},
           ${nombre}, ${telefono}, ${email || null}, ${precioNum}, 'pendiente_pago', ${expira})
        returning id
      `;
      return json({ ok: true, id: ins[0].id });
    } catch (e: any) {
      // 23505 = unique_violation → el cupo ya fue tomado entre que eligió y confirmó
      if (e?.code === '23505' || String(e?.message ?? e).includes('reservas_slot_unico')) {
        return json(
          { ok: false, code: 'SLOT_TOMADO', error: 'Ese horario se ocupó recién. Elegí otro.' },
          409
        );
      }
      throw e;
    }
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
