import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin';
import { getSql } from '../../../lib/db';
import {
  FotoError,
  MAX_BYTES,
  blobConfigurado,
  borrarFoto,
  leerEncuadre,
  limpiarEtiqueta,
  listarFotos,
  renombrarFoto,
  subirFoto,
} from '../../../lib/fotos';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const idOk = (v: unknown): v is string => typeof v === 'string' && /^f-[a-f0-9]{16}$/.test(v);

function error(e: unknown, donde: string) {
  if (e instanceof FotoError) return json({ ok: false, error: e.message }, 400);
  const m = e instanceof Error ? e.message : String(e);
  console.error(`${donde}:`, m);
  return json({ ok: false, error: 'No se pudo completar. Probá de nuevo en un rato.' }, 500);
}

// GET /api/admin/fotos → las fotos subidas por Ceci.
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    return json({ ok: true, configurado: blobConfigurado(), fotos: await listarFotos(getSql()) });
  } catch (e) {
    return error(e, 'GET /api/admin/fotos');
  }
};

// POST /api/admin/fotos
//   multipart: foto (archivo), etiqueta, x, y (encuadre en %, 50/50 = centro) → sube
//   JSON:      { accion: 'renombrar', id, etiqueta } | { accion: 'borrar', id }
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const tipo = request.headers.get('content-type') || '';

  try {
    const sql = getSql();

    if (tipo.startsWith('multipart/form-data')) {
      if (!blobConfigurado()) return json({ ok: false, error: 'Falta conectar el almacenamiento de fotos (BLOB_READ_WRITE_TOKEN).' }, 503);
      // Corte temprano por tamaño, antes de leer el cuerpo (el margen es lo que ocupa el formulario).
      if (Number(request.headers.get('content-length') || 0) > MAX_BYTES + 64 * 1024)
        return json({ ok: false, error: 'La foto es demasiado pesada (máximo 4 MB).' }, 413);
      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return json({ ok: false, error: 'No llegó bien la foto. Probá de nuevo.' }, 400);
      }
      const archivo = form.get('foto');
      if (!(archivo instanceof File)) return json({ ok: false, error: 'No llegó ninguna foto.' }, 400);
      if (archivo.size > MAX_BYTES) return json({ ok: false, error: 'La foto es demasiado pesada (máximo 4 MB).' }, 413);
      const encuadre = leerEncuadre(form.get('x'), form.get('y'));
      const foto = await subirFoto(sql, Buffer.from(await archivo.arrayBuffer()), limpiarEtiqueta(form.get('etiqueta')), encuadre);
      return json({ ok: true, foto, fotos: await listarFotos(sql) });
    }

    let b: any;
    try {
      b = await request.json();
    } catch {
      return json({ ok: false, error: 'Cuerpo inválido' }, 400);
    }
    if (!idOk(b?.id)) return json({ ok: false, error: 'Foto inválida' }, 400);

    if (b.accion === 'renombrar') {
      const foto = await renombrarFoto(sql, b.id, limpiarEtiqueta(b.etiqueta));
      if (!foto) return json({ ok: false, error: 'Esa foto ya no está.' }, 404);
      return json({ ok: true, foto, fotos: await listarFotos(sql) });
    }

    if (b.accion === 'borrar') {
      const r = await borrarFoto(sql, b.id);
      if (!r) return json({ ok: false, error: 'Esa foto ya no está.' }, 404);
      return json({ ok: true, ...r, fotos: await listarFotos(sql) });
    }

    return json({ ok: false, error: 'Acción inválida' }, 400);
  } catch (e) {
    return error(e, 'POST /api/admin/fotos');
  }
};
