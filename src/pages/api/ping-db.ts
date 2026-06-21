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

// Devuelve el host (sin contraseña) para identificar a qué base/rama apunta la app.
function hostFrom(cs?: string) {
  if (!cs) return null;
  try {
    return new URL(cs).host;
  } catch {
    return 'no-parseable';
  }
}

// GET /api/ping-db → diagnóstico: a qué base conecta y qué tablas ve.
export const GET: APIRoute = async () => {
  const envName = process.env.DATABASE_URL
    ? 'DATABASE_URL'
    : process.env.POSTGRES_URL
      ? 'POSTGRES_URL'
      : process.env.DATABASE_URL_UNPOOLED
        ? 'DATABASE_URL_UNPOOLED'
        : process.env.POSTGRES_URL_NON_POOLING
          ? 'POSTGRES_URL_NON_POOLING'
          : null;
  const cs =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;
  const host = hostFrom(cs);

  try {
    const sql = getSql();
    const db = (await sql`select current_database() as d`)[0].d;
    const tables = (
      await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`
    ).map((r: any) => r.table_name);
    return json({ ok: true, envUsada: envName, host, base: db, tablas: tables });
  } catch (e) {
    return json(
      { ok: false, envUsada: envName, host, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
};
