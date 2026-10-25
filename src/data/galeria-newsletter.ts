/**
 * Fotos para el mail del newsletter y la portada de las novedades: Ceci elige
 * una para la cabecera (siempre lleva una) y, si quiere, una para cada novedad.
 * Hay dos clases de foto, que se usan igual:
 *
 * - Fijas: las genera scripts/galeria-newsletter.py en public/email/galeria/ en
 *   dos tamaños: <id>-ancha.jpg (cabecera, 1200x520) y <id>.jpg (novedad,
 *   480x360). Se nombran por su id ('portada', 'espacio-1'…).
 * - Subidas por Ceci desde el panel (pestaña Fotos, src/lib/fotos.ts): viven en
 *   Vercel Blob con los mismos dos tamaños. Se nombran por su dirección base en
 *   Blob, sin el sufijo: `https://<store>.public.blob.vercel-storage.com/galeria/f-<hex>`.
 *   Así un .md del blog o un envío guardado se resuelven sin consultar la base.
 */
export const GALERIA = [
  { id: 'portada', etiqueta: 'Portada del sitio' },
  { id: 'espacio-1', etiqueta: 'El espacio (1)' },
  { id: 'espacio-2', etiqueta: 'El espacio (2)' },
  { id: 'espacio-3', etiqueta: 'El espacio (3)' },
] as const;

export type FotoId = (typeof GALERIA)[number]['id'];
/** Una foto elegible: id de una fija, o dirección base de una subida. */
export type FotoRef = FotoId | string;
export const CABECERA_POR_DEFECTO: FotoId = 'portada';

export const fotoFija = (v: unknown): v is FotoId => GALERIA.some((f) => f.id === v);

/** Dirección base de una foto subida (los previews guardan en preview/galeria/). */
const RE_SUBIDA = /^https:\/\/[a-z0-9]+\.public\.blob\.vercel-storage\.com\/(?:preview\/)?galeria\/f-[a-f0-9]{16}$/;
export const fotoSubida = (v: unknown): v is string => typeof v === 'string' && RE_SUBIDA.test(v);

/**
 * ¿Tiene forma de foto? (fija o subida). No mira si la subida sigue existiendo:
 * eso lo resuelve quien tiene la lista (newsletter.ts, fotos.ts).
 */
export const fotoValida = (v: unknown): v is FotoRef => fotoFija(v) || fotoSubida(v);

/**
 * Rutas de los dos tamaños. Las fijas son relativas al sitio (se completan con
 * la base pública con `absoluta`); las subidas ya son absolutas.
 */
export const rutaCabecera = (f: FotoRef) => (fotoSubida(f) ? `${f}-ancha.jpg` : `/email/galeria/${f}-ancha.jpg`);
export const rutaFoto = (f: FotoRef) => (fotoSubida(f) ? `${f}.jpg` : `/email/galeria/${f}.jpg`);
export const absoluta = (ruta: string, base: string) => (/^https:\/\//.test(ruta) ? ruta : base + ruta);
export const RUTA_LOGO = '/email/logo-cg.png';
export const RUTA_FIRMA = '/email/ceci-firma.jpg';
