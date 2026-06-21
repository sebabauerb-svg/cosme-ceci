import type { APIRoute } from 'astro';
import { getSql } from '../../lib/db';

// Endpoint de servidor (no se prerenderiza)
export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// GET /api/ping-db → verifica que la conexión y el esquema estén OK.
export const GET: APIRoute = async () => {
  try {
    const sql = getSql();
    const rows = await sql`select count(*)::int as n from sedes`;
    return json({ ok: true, sedes: rows[0].n });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
