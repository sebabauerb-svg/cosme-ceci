import type { APIRoute } from 'astro';
import { getSql, ensureFranjas, ensureConfirmacion } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// GET /api/admin/por-confirmar
// Reservas hechas por la web SIN pago (estado 'a_confirmar') que siguen vigentes
// (dentro del hold de 2 h). Alimentan el panel "Reservas a confirmar" del admin.
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureConfirmacion(sql);
    const reservas = (await sql`
      select r.id, r.modalidad, coalesce(s.nombre, 'Online') as sede,
             r.fecha::text as fecha, to_char(r.hora, 'HH24:MI') as hora,
             r.nombre, r.telefono, r.email, r.precio_uyu,
             r.expira_at::text as expira_at
      from reservas r left join sedes s on s.id = r.sede_id
      where r.estado = 'a_confirmar' and (r.expira_at is null or r.expira_at > now())
      order by r.fecha nulls last, r.hora nulls last, r.created_at
    `) as any[];
    return json({ ok: true, reservas });
  } catch (e) {
    console.error('GET /api/admin/por-confirmar:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo cargar.' }, 500);
  }
};
