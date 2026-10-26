import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin';
import { getSql, ensureNewsletter } from '../../../lib/db';
import {
  MAX_ENTRADAS,
  baseUrl,
  cupoHoy,
  entradasPublicadas,
  enviarPrueba,
  enviarTanda,
  htmlNewsletter,
  leerFotos,
  normalizarEmail,
  resendConfigurado,
  topeDiario,
  type EntradaNl,
} from '../../../lib/newsletter';
import { GALERIA, CABECERA_POR_DEFECTO, rutaFoto } from '../../../data/galeria-newsletter';
import { listarFotos, refsDisponibles } from '../../../lib/fotos';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const uuidOk = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

async function resumen(sql: any) {
  const [c] = (await sql`
    select count(*) filter (where estado = 'confirmado')::int as confirmados,
           count(*) filter (where estado = 'pendiente')::int as pendientes,
           count(*) filter (where estado = 'baja')::int as bajas
      from newsletter_suscriptores
  `) as any[];
  const envios = (await sql`
    select id, asunto, entradas, total, enviados, created_at, terminado_at
      from newsletter_envios order by created_at desc limit 8
  `) as any[];
  return { ...c, envios, cupoHoy: await cupoHoy(sql), tope: topeDiario() };
}

// GET /api/admin/newsletter → números de la lista, envíos anteriores y novedades publicadas.
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const sql = getSql();
    await ensureNewsletter(sql);
    return json({
      ok: true,
      resend: resendConfigurado(),
      pruebaA: process.env.CECI_NOTIF_EMAIL || '',
      entradas: await entradasPublicadas(),
      // Galería para elegir: primero las fotos que subió Ceci, después las fijas
      // (miniaturas servidas por este mismo sitio). `id` es lo que se guarda.
      galeria: [
        ...(await listarFotos(sql)).map((f) => ({ id: f.ref, etiqueta: f.etiqueta, miniatura: f.miniatura, subida: true })),
        ...GALERIA.map((f) => ({ ...f, miniatura: rutaFoto(f.id) })),
      ],
      cabeceraPorDefecto: CABECERA_POR_DEFECTO,
      ...(await resumen(sql)),
    });
  } catch (e) {
    console.error('GET /api/admin/newsletter:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo leer la lista.' }, 500);
  }
};

// POST /api/admin/newsletter
//   (vista / prueba / enviar llevan además fotos: { cabecera, porEntrada: { slug: foto } })
//   { accion: 'vista', entradas, asunto, intro }         → { html }
//   { accion: 'prueba', entradas, asunto, intro, para }  → manda solo a `para`
//   { accion: 'enviar', entradas, asunto, intro }        → crea el envío y manda la tanda de hoy
//   { accion: 'continuar', envioId }                     → manda la tanda de hoy de un envío a medias
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let b: any;
  try {
    b = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }
  const accion = b?.accion;
  const base = baseUrl(request);

  try {
    const sql = getSql();
    await ensureNewsletter(sql);

    if (accion === 'continuar') {
      if (!resendConfigurado()) return json({ ok: false, error: 'Falta configurar RESEND_API_KEY.' }, 503);
      if (!uuidOk(b?.envioId)) return json({ ok: false, error: 'Envío inválido' }, 400);
      const r = await enviarTanda(sql, b.envioId, base);
      return json({ ok: true, ...r, ...(await resumen(sql)) });
    }

    // Armado del mail: 1 a 3 novedades ya publicadas, en el orden elegido.
    const publicadas = await entradasPublicadas();
    const slugs: string[] = Array.isArray(b?.entradas) ? [...new Set(b.entradas as unknown[])].filter((s): s is string => typeof s === 'string') : [];
    const entradas = slugs.map((s) => publicadas.find((e) => e.slug === s)).filter((e): e is EntradaNl => !!e);
    if (!entradas.length || entradas.length !== slugs.length)
      return json({ ok: false, error: 'Elegí entre 1 y 3 novedades publicadas.' }, 400);
    if (entradas.length > MAX_ENTRADAS) return json({ ok: false, error: `Como máximo ${MAX_ENTRADAS} novedades por envío.` }, 400);
    const asunto = typeof b?.asunto === 'string' ? b.asunto.trim().replace(/\s+/g, ' ').slice(0, 120) : '';
    const intro = typeof b?.intro === 'string' ? b.intro.trim().slice(0, 2000) : '';
    if (!asunto) return json({ ok: false, error: 'Falta el asunto.' }, 400);
    const fotos = leerFotos(b?.fotos, slugs, await refsDisponibles(sql));

    if (accion === 'vista') {
      return json({ ok: true, html: htmlNewsletter({ intro, entradas, base, linkBaja: `${base}/newsletter/baja?prueba=1`, fotos, baseImg: new URL(request.url).origin }) });
    }

    if (!resendConfigurado()) return json({ ok: false, error: 'Falta configurar RESEND_API_KEY.' }, 503);

    if (accion === 'prueba') {
      const para = normalizarEmail(b?.para);
      if (!para) return json({ ok: false, error: 'Revisá el email de la prueba.' }, 400);
      await enviarPrueba({ to: para, asunto, intro, entradas, base, fotos });
      return json({ ok: true });
    }

    if (accion === 'enviar') {
      const [{ n }] = (await sql`select count(*)::int as n from newsletter_suscriptores where estado = 'confirmado'`) as any[];
      if (!n) return json({ ok: false, error: 'Todavía no hay nadie suscripto.' }, 400);
      const [env] = (await sql`
        insert into newsletter_envios (asunto, intro, entradas, total, fotos)
        values (${asunto}, ${intro || null}, ${entradas.map((e) => e.slug)}, ${n}, ${JSON.stringify(fotos)}::jsonb)
        returning id
      `) as any[];
      const r = await enviarTanda(sql, env.id, base);
      return json({ ok: true, envioId: env.id, ...r, ...(await resumen(sql)) });
    }

    return json({ ok: false, error: 'Acción inválida' }, 400);
  } catch (e) {
    const m = e instanceof Error ? e.message : String(e);
    console.error('POST /api/admin/newsletter:', m);
    return json({ ok: false, error: `No se pudo completar: ${m}` }, 500);
  }
};
