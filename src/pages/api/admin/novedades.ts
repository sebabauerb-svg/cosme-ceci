import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin';
import {
  TIPOS,
  GithubError,
  githubConfigurado,
  guardarEntrada,
  leerEntrada,
  listarEntradas,
  slugDe,
  slugValido,
  type Entrada,
  type Tipo,
} from '../../../lib/novedades';
import { fotoFija, fotoSubida } from '../../../data/galeria-newsletter';
import { getSql } from '../../../lib/db';
import { refsDisponibles } from '../../../lib/fotos';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const hoyUY = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

function errorGithub(e: unknown) {
  if (e instanceof GithubError) {
    if (e.status === 401 || e.status === 403)
      return json({ ok: false, error: 'GitHub rechazó el token (GITHUB_TOKEN vencido o sin permiso de escritura).' }, 502);
    if (e.status === 409)
      return json({ ok: false, error: 'La entrada cambió mientras la editabas. Recargá la lista y volvé a intentar.' }, 409);
    return json({ ok: false, error: `GitHub: ${e.message}` }, 502);
  }
  return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
}

// GET /api/admin/novedades → lista de entradas (con cuerpo, para editarlas).
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  if (!githubConfigurado()) return json({ ok: false, configurado: false, error: 'Falta GITHUB_TOKEN' }, 503);
  try {
    return json({ ok: true, entradas: await listarEntradas() });
  } catch (e) {
    return errorGithub(e);
  }
};

// POST /api/admin/novedades
// Crear:      { titulo, descripcion, tipo, cuerpo, publicado, fecha? }
// Editar:     { slug, sha, titulo, descripcion, tipo, cuerpo, publicado, fecha? }
// Publicar / despublicar sin abrir el editor: { slug, sha, soloPublicado: true, publicado }
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  if (!githubConfigurado()) return json({ ok: false, configurado: false, error: 'Falta GITHUB_TOKEN' }, 503);

  let b: any;
  try {
    b = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const publicado = b?.publicado === true;
  const editando = b?.slug != null;
  if (editando && (!slugValido(b.slug) || typeof b.sha !== 'string'))
    return json({ ok: false, error: 'Entrada inválida' }, 400);

  try {
    if (b?.soloPublicado === true) {
      const actual = await leerEntrada(b.slug);
      if (!actual) return json({ ok: false, error: 'La entrada ya no existe' }, 404);
      if (actual.sha !== b.sha) return errorGithub(new GithubError('', 409));
      const e = { ...actual.entrada, publicado };
      const sha = await guardarEntrada(e, actual.sha, `Novedades: ${publicado ? 'publica' : 'despublica'} «${e.titulo}» (panel)`);
      return json({ ok: true, entrada: { ...e, sha } });
    }

    const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
    const titulo = txt(b?.titulo, 140).replace(/\s+/g, ' ');
    const descripcion = txt(b?.descripcion, 300).replace(/\s+/g, ' ');
    const cuerpo = txt(b?.cuerpo, 40000);
    const tipo: Tipo = (TIPOS as readonly string[]).includes(b?.tipo) ? b.tipo : 'novedad';
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(b?.fecha) ? b.fecha : hoyUY();

    if (!titulo) return json({ ok: false, error: 'Falta el título' }, 400);
    if (!descripcion) return json({ ok: false, error: 'Falta la descripción' }, 400);
    if (!cuerpo) return json({ ok: false, error: 'Falta el texto' }, 400);

    let slug: string;
    let shaPrevio: string | null = null;
    let autora = 'Ceci';
    if (editando) {
      slug = b.slug;
      shaPrevio = b.sha;
      const actual = await leerEntrada(slug);
      if (!actual) return json({ ok: false, error: 'La entrada ya no existe' }, 404);
      autora = actual.entrada.autora;
    } else {
      // La dirección sale del título; si ya existe, se numera (-2, -3…).
      const base = slugDe(titulo) || `novedad-${fecha}`;
      slug = base;
      for (let n = 2; await leerEntrada(slug); n++) {
        if (n > 20) return json({ ok: false, error: 'Ya hay demasiadas entradas con ese título' }, 409);
        slug = `${base}-${n}`;
      }
    }

    // Portada: una foto fija, o una de las que subió Ceci (si todavía está en "Mis fotos").
    const imagen = fotoFija(b?.imagen) || (fotoSubida(b?.imagen) && (await refsDisponibles(getSql())).has(b.imagen))
      ? (b.imagen as string)
      : undefined;
    const e: Entrada = { slug, titulo, descripcion, fecha, autora, tipo, publicado, cuerpo, imagen };
    const sha = await guardarEntrada(e, shaPrevio, `Novedades: ${editando ? 'edita' : 'nueva'} «${titulo}» (panel)`);
    return json({ ok: true, entrada: { ...e, sha } });
  } catch (e) {
    return errorGithub(e);
  }
};
