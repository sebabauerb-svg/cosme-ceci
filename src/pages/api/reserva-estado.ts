import type { APIRoute } from 'astro';
import { getSql } from '../../lib/db';

export const prerender = false;

// GET /api/reserva-estado?id=<uuid>  → estado real de una reserva.
// Lo usa /reservar al volver de MercadoPago: el query param ?pago=ok solo dice
// que MP redirigió, la confirmación real la hace el webhook. Devuelve lo mínimo
// (solo el estado) porque el id viaja por URL.
export const GET: APIRoute = async ({ url }) => {
  const id = url.searchParams.get('id') || '';
  const headers = { 'content-type': 'application/json' };
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new Response(JSON.stringify({ ok: false }), { status: 400, headers });
  }
  try {
    const sql = getSql();
    const r = (await sql`select estado from reservas where id = ${id}`) as any[];
    if (!r.length) return new Response(JSON.stringify({ ok: false }), { status: 404, headers });
    return new Response(JSON.stringify({ ok: true, estado: r[0].estado }), { status: 200, headers });
  } catch (e) {
    console.error('GET /api/reserva-estado:', e instanceof Error ? e.message : e);
    return new Response(JSON.stringify({ ok: false }), { status: 500, headers });
  }
};
