/**
 * "Mis fotos": fotos que Ceci sube desde el panel para el newsletter (cabecera
 * y foto de cada novedad) y para la portada de las novedades del blog. Se usan
 * igual que las fijas de src/data/galeria-newsletter.ts.
 *
 * Dónde viven: Vercel Blob **público** (son para mails y para la web pública;
 * las fotos de las fichas de pacientes NO van acá). El servidor recibe la foto,
 * la valida, le saca los metadatos (incluida la ubicación GPS del celular) y la
 * guarda en los dos tamaños de la galería, en JPG liviano:
 *   <base>-ancha.jpg  1200x520 (cabecera del mail y portada de la nota)
 *   <base>.jpg        480x360  (foto de cada novedad y tarjetas del blog)
 * `base` (la dirección sin el sufijo) es lo que se guarda en los .md y en los
 * envíos, así se resuelve sin consultar la base de datos.
 *
 * Borrar: la foto deja de ofrecerse en el panel y las novedades del blog que la
 * tenían de portada vuelven a la automática (commit por GitHub, como el editor).
 * Los archivos se borran de Blob salvo que la foto haya salido en un newsletter:
 * esos mails ya están en las casillas y sus fotos tienen que seguir viéndose.
 *
 * Variable: BLOB_READ_WRITE_TOKEN (la crea Vercel al conectar el store al proyecto).
 */

import crypto from 'node:crypto';
import sharp from 'sharp';
import { put, del } from '@vercel/blob';
import { getCollection } from 'astro:content';
import { ensureNewsletter } from './db';
import { githubConfigurado, guardarEntrada, listarEntradas } from './novedades';
import { fotoSubida } from '../data/galeria-newsletter';

/** Lo que entra en una llamada a una función de Vercel (4,5 MB) con margen. El panel achica antes de subir. */
export const MAX_BYTES = 4 * 1024 * 1024;
/** Tope de fotos visibles en el panel (cada una ocupa ~250 KB en Blob; el plan gratis trae 1 GB). */
export const MAX_FOTOS = 60;
export const MAX_ETIQUETA = 40;

/**
 * Encuadre: qué punto de la foto queda a la vista al recortarla, en % del ancho
 * (x) y del alto (y). 50/50 = centro. Es la misma cuenta que `object-position`
 * en CSS, así que la vista previa del panel muestra exactamente el recorte.
 */
export type Encuadre = { x: number; y: number };
export function leerEncuadre(x: unknown, y: unknown): Encuadre {
  const n = (v: unknown) => {
    const k = Number(v);
    return Number.isFinite(k) ? Math.min(100, Math.max(0, Math.round(k))) : 50;
  };
  return { x: n(x), y: n(y) };
}

export const blobConfigurado = () => !!process.env.BLOB_READ_WRITE_TOKEN;

export class FotoError extends Error {}

export async function ensureFotos(sql: any) {
  await sql`
    create table if not exists galeria_fotos (
      id text primary key,
      etiqueta text not null,
      base_url text not null unique,
      created_at timestamptz not null default now(),
      borrada_at timestamptz,
      archivos_borrados boolean not null default false
    )
  `;
}

export type Foto = { id: string; etiqueta: string; ref: string; miniatura: string; subida: true };

const aFoto = (r: any): Foto => ({ id: r.id, etiqueta: r.etiqueta, ref: r.base_url, miniatura: `${r.base_url}.jpg`, subida: true });

/** Las fotos que Ceci ve en el panel, de la más nueva a la más vieja. */
export async function listarFotos(sql: any): Promise<Foto[]> {
  await ensureFotos(sql);
  const filas = (await sql`
    select id, etiqueta, base_url from galeria_fotos where borrada_at is null order by created_at desc
  `) as any[];
  return filas.map(aFoto);
}

/**
 * Direcciones de fotos subidas que se pueden usar en un mail. Para armar uno
 * nuevo, solo las visibles. Para continuar un envío ya empezado, también las
 * borradas cuyos archivos se conservaron (salieron en ese envío).
 */
export async function refsDisponibles(sql: any, o: { conservadas?: boolean } = {}): Promise<Set<string>> {
  await ensureFotos(sql);
  const filas = (o.conservadas
    ? await sql`select base_url from galeria_fotos where not archivos_borrados`
    : await sql`select base_url from galeria_fotos where borrada_at is null`) as any[];
  return new Set(filas.map((f) => f.base_url as string));
}

export function limpiarEtiqueta(v: unknown): string {
  return typeof v === 'string'
    ? v.replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_ETIQUETA)
    : '';
}

/**
 * Tipo real por los primeros bytes (no por la extensión ni por lo que diga el
 * navegador). Solo JPG, PNG y WebP: nada de SVG ni HTML, que pueden llevar
 * código, ni formatos que el servidor no sabe leer (HEIC: el panel lo convierte).
 */
function formatoPorBytes(b: Buffer): 'jpeg' | 'png' | 'webp' | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/** Valida, recorta a los dos tamaños, sube a Blob y la anota. */
export async function subirFoto(sql: any, datos: Buffer, etiqueta: string, encuadre: Encuadre): Promise<Foto> {
  if (!datos.length) throw new FotoError('No llegó ninguna foto.');
  if (datos.length > MAX_BYTES) throw new FotoError('La foto es demasiado pesada (máximo 4 MB).');
  const formato = formatoPorBytes(datos);
  if (!formato) throw new FotoError('Ese archivo no es una foto JPG, PNG o WebP.');
  if (!etiqueta) throw new FotoError('Ponele un nombre corto a la foto.');

  await ensureFotos(sql);
  const [{ n }] = (await sql`select count(*)::int as n from galeria_fotos where borrada_at is null`) as any[];
  if (n >= MAX_FOTOS) throw new FotoError(`Ya tenés ${MAX_FOTOS} fotos. Borrá alguna que no uses para subir otra.`);

  // limitInputPixels: frena imágenes gigantes armadas para colgar el servidor.
  const entrada = () => sharp(datos, { limitInputPixels: 60_000_000, failOn: 'error' }).autoOrient();
  let meta: sharp.Metadata;
  try {
    meta = await sharp(datos, { limitInputPixels: 60_000_000 }).metadata();
  } catch {
    throw new FotoError('No se pudo leer la foto. Probá con otra o sacala de nuevo.');
  }
  if (meta.format !== formato) throw new FotoError('Ese archivo no es una foto JPG, PNG o WebP.');
  // Medidas ya giradas según la cámara (EXIF), que es como se ve en el panel.
  const W = meta.autoOrient?.width || meta.width || 0;
  const H = meta.autoOrient?.height || meta.height || 0;
  if (W < 400 || H < 300) throw new FotoError('La foto es muy chica: tiene que medir al menos 400 x 300.');

  // Cubre w x h y corta lo que sobra según el encuadre (igual que object-fit:
  // cover + object-position). sharp no copia los metadatos (EXIF, GPS) a menos
  // que se le pida: salen limpias.
  const jpg = (w: number, h: number) => {
    const k = Math.max(w / W, h / H);
    const rw = Math.max(w, Math.round(W * k));
    const rh = Math.max(h, Math.round(H * k));
    return entrada()
      .resize(rw, rh, { fit: 'fill' })
      .extract({ left: Math.round(((rw - w) * encuadre.x) / 100), top: Math.round(((rh - h) * encuadre.y) / 100), width: w, height: h })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 78, mozjpeg: true, progressive: true })
      .toBuffer();
  };
  let ancha: Buffer, chica: Buffer;
  try {
    [ancha, chica] = await Promise.all([jpg(1200, 520), jpg(480, 360)]);
  } catch {
    throw new FotoError('No se pudo procesar la foto. Probá con otra.');
  }

  const id = 'f-' + crypto.randomBytes(8).toString('hex');
  // Los previews guardan aparte, para que las pruebas no se mezclen con lo real.
  const carpeta = process.env.VERCEL_ENV === 'production' ? 'galeria' : 'preview/galeria';
  const opciones = {
    access: 'public' as const,
    contentType: 'image/jpeg',
    addRandomSuffix: false,
    // El nombre es único y no se reescribe nunca: se puede cachear un año.
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  };
  const r = await put(`${carpeta}/${id}-ancha.jpg`, ancha, opciones);
  await put(`${carpeta}/${id}.jpg`, chica, opciones);
  const base = r.url.replace(/-ancha\.jpg$/, '');
  if (!fotoSubida(base)) {
    await del([r.url, `${base}.jpg`]).catch(() => {});
    throw new Error(`Blob devolvió una dirección inesperada: ${r.url}`);
  }

  const [fila] = (await sql`
    insert into galeria_fotos (id, etiqueta, base_url) values (${id}, ${etiqueta}, ${base})
    returning id, etiqueta, base_url
  `) as any[];
  return aFoto(fila);
}

export async function renombrarFoto(sql: any, id: string, etiqueta: string): Promise<Foto | null> {
  if (!etiqueta) throw new FotoError('Ponele un nombre corto a la foto.');
  await ensureFotos(sql);
  const [fila] = (await sql`
    update galeria_fotos set etiqueta = ${etiqueta} where id = ${id} and borrada_at is null
    returning id, etiqueta, base_url
  `) as any[];
  return fila ? aFoto(fila) : null;
}

export type ResultadoBorrado = {
  /** Títulos de las novedades del blog que volvieron a la portada automática. */
  novedades: string[];
  /** Novedades que la siguen usando porque no se pudo tocar el .md (sin GITHUB_TOKEN o error). */
  pendientes: string[];
  /** Los archivos quedaron en Blob (salió en un newsletter, o la usa una novedad que no se pudo actualizar). */
  conservada: boolean;
};

export async function borrarFoto(sql: any, id: string): Promise<ResultadoBorrado | null> {
  await ensureFotos(sql);
  const [fila] = (await sql`
    update galeria_fotos set borrada_at = now() where id = ${id} and borrada_at is null
    returning base_url
  `) as any[];
  if (!fila) return null;
  const ref: string = fila.base_url;

  // Novedades del blog que la tienen de portada → vuelven a la automática.
  const novedades: string[] = [];
  const pendientes: string[] = [];
  if (githubConfigurado()) {
    try {
      for (const e of await listarEntradas()) {
        if (e.imagen !== ref) continue;
        const { sha, ...entrada } = e;
        try {
          await guardarEntrada({ ...entrada, imagen: undefined }, sha, `Novedades: "${e.titulo}" vuelve a la portada automática (se borró la foto)`);
          novedades.push(e.titulo);
        } catch {
          pendientes.push(e.titulo);
        }
      }
    } catch {
      pendientes.push('(no se pudo revisar el blog)');
    }
  } else {
    const todas = await getCollection('blog');
    for (const e of todas) if (e.data.imagen === ref) pendientes.push(e.data.titulo);
  }

  // ¿Salió en algún newsletter? Esos mails la siguen mostrando: no se borra el archivo.
  await ensureNewsletter(sql);
  const [{ enviada }] = (await sql`
    select exists (select 1 from newsletter_envios where fotos::text like ${'%' + ref + '%'}) as enviada
  `) as any[];

  const conservada = enviada || pendientes.length > 0;
  if (!conservada) {
    try {
      await del([`${ref}-ancha.jpg`, `${ref}.jpg`]);
      await sql`update galeria_fotos set archivos_borrados = true where id = ${id}`;
    } catch (e) {
      // No es grave: la foto ya no se ofrece; el archivo queda huérfano en Blob.
      console.error('borrarFoto: no se pudo borrar de Blob:', e instanceof Error ? e.message : e);
    }
  }
  return { novedades, pendientes, conservada };
}
