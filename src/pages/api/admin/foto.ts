import type { APIRoute } from 'astro';
import { getSql, ensureSeguimiento } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/foto?id=<foto>&t=mini  → la imagen (miniatura con t=mini).
 * Solo con la sesión del panel: las fotos de pacientes nunca tienen un link
 * público. No se guardan en caché (puede ser un celular compartido).
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return new Response('No autorizado', { status: 401 });
  const id = url.searchParams.get('id') ?? '';
  if (!UUID.test(id)) return new Response('Foto inválida', { status: 400 });
  const mini = url.searchParams.get('t') === 'mini';
  try {
    const sql = getSql();
    await ensureSeguimiento(sql);
    const r = (mini
      ? await sql`select mime, encode(mini, 'base64') as b from fotos where id = ${id}`
      : await sql`select mime, encode(datos, 'base64') as b from fotos where id = ${id}`) as any[];
    if (!r.length) return new Response('No existe', { status: 404 });
    return new Response(Buffer.from(r[0].b, 'base64'), {
      headers: {
        'content-type': r[0].mime,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (e) {
    console.error('GET /api/admin/foto:', e instanceof Error ? e.message : e);
    return new Response('Error', { status: 500 });
  }
};
