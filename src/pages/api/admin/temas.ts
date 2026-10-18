import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin';
import { getSql, ensureTemas } from '../../../lib/db';
import { researchConfigurado } from '../../../lib/research';
import { ESTADOS, listarTemas, researchSemanal, type Estado } from '../../../lib/temas';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const uuidOk = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

// "Investigar ahora" a mano: como mucho una vez cada 6 horas (cada corrida cuesta).
let ultimoManual = 0;

// GET /api/admin/temas → agenda de temas (ideas y elegidos primero).
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const sql = getSql();
    await ensureTemas(sql);
    return json({ ok: true, research: researchConfigurado(), temas: await listarTemas(sql) });
  } catch (e) {
    console.error('GET /api/admin/temas:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo leer la agenda.' }, 500);
  }
};

// POST /api/admin/temas
//   { accion: 'crear', titulo, angulo? }          → idea anotada por Ceci
//   { accion: 'estado', id, estado, slug? }       → elegir / descartar / marcar publicado
//   { accion: 'investigar' }                      → corre el research ahora
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let b: any;
  try {
    b = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  try {
    const sql = getSql();
    await ensureTemas(sql);

    if (b?.accion === 'crear') {
      const titulo = txt(b.titulo, 160);
      if (!titulo) return json({ ok: false, error: 'Escribí el tema.' }, 400);
      await sql`
        insert into agenda_temas (titulo, angulo, estado, origen)
        values (${titulo}, ${txt(b.angulo, 500) || null}, 'idea', 'ceci')
      `;
      return json({ ok: true, temas: await listarTemas(sql) });
    }

    if (b?.accion === 'estado') {
      if (!uuidOk(b.id) || !(ESTADOS as readonly string[]).includes(b.estado))
        return json({ ok: false, error: 'Datos inválidos' }, 400);
      const slug = /^[a-z0-9]+(-[a-z0-9]+)*$/.test(b?.slug ?? '') ? b.slug : null;
      await sql`
        update agenda_temas
           set estado = ${b.estado as Estado}, slug = coalesce(${slug}, slug), updated_at = now()
         where id = ${b.id}
      `;
      return json({ ok: true, temas: await listarTemas(sql) });
    }

    if (b?.accion === 'investigar') {
      if (!researchConfigurado()) return json({ ok: false, error: 'Falta configurar ANTHROPIC_API_KEY en Vercel.' }, 503);
      if (Date.now() - ultimoManual < 6 * 3600 * 1000)
        return json({ ok: false, error: 'Ya se investigó hace poco. Probá de nuevo en unas horas.' }, 429);
      ultimoManual = Date.now();
      const base = new URL(request.url).origin;
      const nuevos = await researchSemanal(sql, base);
      return json({ ok: true, nuevos: nuevos.length, temas: await listarTemas(sql) });
    }

    return json({ ok: false, error: 'Acción inválida' }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error('POST /api/admin/temas:', m);
    return json({ ok: false, error: `No se pudo completar: ${m}` }, 500);
  }
};
