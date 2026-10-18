import type { APIRoute } from 'astro';
import { getSql, ensureTemas } from '../../../lib/db';
import { researchConfigurado } from '../../../lib/research';
import { researchSemanal } from '../../../lib/temas';

export const prerender = false;

/**
 * GET /api/cron/research — lo llama el cron de Vercel los domingos a las 11:00 UTC
 * (08:00 en Uruguay), ver vercel.json. Investiga novedades del mundo del
 * skincare y carga temas en la agenda del panel (src/lib/research.ts).
 *
 * Seguridad: igual que /api/cron/recordatorios, exige
 * `Authorization: Bearer $CRON_SECRET` (en producción, sin secret no corre):
 * cada corrida cuesta dinero en la API de Claude.
 */
export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return new Response('no autorizado', { status: 401 });
    }
  } else if (import.meta.env.PROD) {
    console.error('cron research: CRON_SECRET sin configurar — no se ejecuta');
    return new Response('secret no configurado', { status: 401 });
  }
  if (!researchConfigurado()) {
    return Response.json({ ok: false, error: 'Falta ANTHROPIC_API_KEY' }, { status: 503 });
  }

  try {
    const sql = getSql();
    await ensureTemas(sql);
    const base = (process.env.PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
    const temas = await researchSemanal(sql, base);
    return Response.json({ ok: true, temas: temas.length });
  } catch (e) {
    console.error('cron research:', e instanceof Error ? e.message : e);
    return Response.json({ ok: false, error: 'El research falló' }, { status: 500 });
  }
};
