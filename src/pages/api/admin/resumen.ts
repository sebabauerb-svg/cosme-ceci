import type { APIRoute } from 'astro';
import { getSql, ensureFranjas, ensureConfirmacion } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// GET /api/admin/resumen?dias=21
// Vista consolidada de TODAS las sedes para los próximos días: turnos abiertos
// (disponibles) y reservas (web o manual). Alimenta la agenda del panel.
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const dias = Math.max(7, Math.min(60, Number(url.searchParams.get('dias')) || 21));
  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureConfirmacion(sql);
    const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const finD = new Date(Date.now() - 3 * 3600 * 1000 + dias * 86400000).toISOString().slice(0, 10);

    const franjas = (await sql`
      select coalesce(s.nombre, 'Online') as sede, f.fecha::text as fecha, to_char(f.hora, 'HH24:MI') as hora
      from franjas f left join sedes s on s.id = f.sede_id
      where f.fecha >= ${hoy} and f.fecha <= ${finD}
      order by f.fecha, f.hora
    `) as any[];

    const reservas = (await sql`
      select coalesce(s.nombre, 'Online') as sede, r.fecha::text as fecha, to_char(r.hora, 'HH24:MI') as hora,
             r.nombre, r.modalidad
      from reservas r left join sedes s on s.id = r.sede_id
      where r.fecha >= ${hoy} and r.fecha <= ${finD}
        and (r.estado = 'confirmada'
             or (r.estado in ('pendiente_pago','a_confirmar') and (r.expira_at is null or r.expira_at > now())))
      order by r.fecha, r.hora
    `) as any[];

    return json({ ok: true, hoy, franjas, reservas });
  } catch (e) {
    console.error('GET /api/admin/resumen:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo cargar el resumen.' }, 500);
  }
};
