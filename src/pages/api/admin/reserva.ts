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

// DELETE /api/admin/reserva?id=...  → borra una reserva (libera el cupo)
export const DELETE: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ ok: false, error: 'Falta id' }, 400);
  try {
    const sql = getSql();
    await sql`delete from reservas where id = ${id}`;
    return json({ ok: true });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
