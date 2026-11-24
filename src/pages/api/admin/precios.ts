import type { APIRoute } from 'astro';
import { getSql, ensurePrecios } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { clavesValidas, invalidarPrecios, itemsVigentes } from '../../../lib/precios-vigentes';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const MAX = 1_000_000;
/** Entero en pesos o null ("valor en consulta" / sin paquete). Undefined = inválido. */
function monto(v: unknown): number | null | undefined {
  if (v === null || v === '') return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 0 || v > MAX) return undefined;
  return v;
}

// GET /api/admin/precios → catálogo con los valores vigentes.
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  return json({ ok: true, items: await itemsVigentes() });
};

// POST /api/admin/precios
// body: { precios: [{ clave, precio: int|null, paquete6: int|null, sena?: int|null }] }
// `sena` solo viaja si el panel muestra la columna: si no viene, no se toca.
// Guarda (upsert) los ítems enviados. precio null = "Valor en consulta".
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }
  const lista: any[] = Array.isArray(body?.precios) ? body.precios : [];
  if (!lista.length) return json({ ok: false, error: 'No hay precios para guardar.' }, 400);

  const validas = clavesValidas();
  const filas: { clave: string; precio: number | null; paquete6: number | null; sena?: number | null }[] = [];
  for (const it of lista) {
    const precio = monto(it?.precio);
    const paquete6 = monto(it?.paquete6);
    const conSena = it && typeof it === 'object' && 'sena' in it;
    const sena = conSena ? monto(it.sena) : null;
    if (
      typeof it?.clave !== 'string' || !validas.has(it.clave) || precio === undefined || paquete6 === undefined ||
      sena === undefined || (conSena && !it.clave.startsWith('trat:'))
    ) {
      return json({ ok: false, error: `Valor inválido en ${it?.clave ?? 'un ítem'}.` }, 400);
    }
    // Seña 0 = sin seña propia (vale la general).
    filas.push({ clave: it.clave, precio, paquete6: precio == null ? null : paquete6, ...(conSena ? { sena: sena || null } : {}) });
  }

  try {
    const sql = getSql();
    await ensurePrecios(sql);
    await sql.transaction(
      filas.map((f) =>
        'sena' in f
          ? sql`
              insert into precios (clave, precio, paquete6, sena, updated_at)
              values (${f.clave}, ${f.precio}, ${f.paquete6}, ${f.sena ?? null}, now())
              on conflict (clave) do update
                set precio = excluded.precio, paquete6 = excluded.paquete6, sena = excluded.sena, updated_at = now()
            `
          : sql`
              insert into precios (clave, precio, paquete6, updated_at)
              values (${f.clave}, ${f.precio}, ${f.paquete6}, now())
              on conflict (clave) do update
                set precio = excluded.precio, paquete6 = excluded.paquete6, updated_at = now()
            `
      )
    );
    invalidarPrecios();
    return json({ ok: true, guardados: filas.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/admin/precios:', msg);
    return json({ ok: false, error: 'No se pudieron guardar los precios. Probá de nuevo.' }, 500);
  }
};
