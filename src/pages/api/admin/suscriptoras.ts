import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { isAdmin } from '../../../lib/admin';
import { getSql, ensureNewsletter } from '../../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const ESTADOS = ['pendiente', 'confirmado', 'baja'];
const uuidOk = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** Celda CSV segura: comillas escapadas y sin fórmulas (Excel ejecuta =, +, -, @). */
const celda = (v: unknown) => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

// GET /api/admin/suscriptoras?q=&estado=&formato=csv
// Lista de la base del newsletter (las suprimidas no se muestran).
export const GET: APIRoute = async ({ cookies, url }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const q = (url.searchParams.get('q') || '').trim().toLowerCase().slice(0, 100);
  const estado = url.searchParams.get('estado');
  const filtroEstado = estado && ESTADOS.includes(estado) ? estado : null;
  try {
    const sql = getSql();
    await ensureNewsletter(sql);
    const filas = (await sql`
      select id, email, estado, origen, created_at, confirmado_at, baja_at
        from newsletter_suscriptores
       where suprimido_at is null
         and (${filtroEstado}::text is null or estado = ${filtroEstado})
         and (${q} = '' or email like ${'%' + q.replace(/[%_\\]/g, '\\$&') + '%'})
       order by created_at desc
       limit 2000
    `) as any[];

    if (url.searchParams.get('formato') === 'csv') {
      const csv = [
        ['email', 'estado', 'origen', 'alta', 'confirmacion', 'baja'].map(celda).join(','),
        ...filas.map((f) =>
          [f.email, f.estado, f.origen, f.created_at, f.confirmado_at, f.baja_at]
            .map((v) => celda(v instanceof Date ? v.toISOString() : v))
            .join(',')
        ),
      ].join('\r\n');
      const hoy = new Date().toISOString().slice(0, 10);
      return new Response('﻿' + csv, {
        headers: {
          'content-type': 'text/csv; charset=utf-8',
          'content-disposition': `attachment; filename="suscriptas-newsletter-${hoy}.csv"`,
          'cache-control': 'no-store',
        },
      });
    }
    return json({ ok: true, suscriptoras: filas });
  } catch (e) {
    console.error('GET /api/admin/suscriptoras:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo leer la lista.' }, 500);
  }
};

// POST /api/admin/suscriptoras  { accion: 'suprimir', id }
// Derecho de supresión: borra el email (queda uno anónimo) y deja constancia de
// la fecha. No se puede deshacer: si la persona quiere volver, se suscribe de nuevo.
export const POST: APIRoute = async ({ cookies, request }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let b: any;
  try {
    b = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }
  if (b?.accion !== 'suprimir' || !uuidOk(b.id)) return json({ ok: false, error: 'Datos inválidos' }, 400);
  try {
    const sql = getSql();
    await ensureNewsletter(sql);
    const anonimo = `suprimido-${crypto.randomBytes(8).toString('hex')}@invalid`;
    const r = (await sql`
      update newsletter_suscriptores
         set email = ${anonimo}, estado = 'baja', baja_at = coalesce(baja_at, now()),
             suprimido_at = now(), origen = null,
             token = replace(gen_random_uuid()::text, '-', '')
       where id = ${b.id} and suprimido_at is null
       returning id
    `) as any[];
    if (!r.length) return json({ ok: false, error: 'Ya no está en la lista.' }, 404);
    console.log('newsletter: supresión registrada', b.id);
    return json({ ok: true });
  } catch (e) {
    console.error('POST /api/admin/suscriptoras:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo eliminar.' }, 500);
  }
};
