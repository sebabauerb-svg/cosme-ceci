import { getCollection, type CollectionEntry } from 'astro:content';
import { GALERIA, fotoSubida, fotoValida, rutaCabecera, rutaFoto, type FotoRef } from '../data/galeria-newsletter';

export type Entrada = CollectionEntry<'blog'>;
export type Tipo = Entrada['data']['tipo'];

/** Etiqueta visible de cada tipo de entrada (singular y plural para los filtros). */
export const TIPOS: Record<Tipo, { label: string; plural: string }> = {
  novedad: { label: 'Novedad', plural: 'Novedades' },
  tip: { label: 'Tip', plural: 'Tips' },
  nota: { label: 'Nota', plural: 'Notas' },
};

/**
 * Entradas visibles, de la más reciente a la más vieja. Los borradores
 * (`publicado: false`) solo aparecen en `npm run dev`, para poder revisarlos
 * antes de publicarlos; nunca llegan al build de producción ni al sitemap.
 */
export async function getEntradas(): Promise<Entrada[]> {
  const entradas = await getCollection('blog', ({ data }) => data.publicado || import.meta.env.DEV);
  return entradas.sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime());
}

export const fmtFecha = (d: Date) =>
  d.toLocaleDateString('es-UY', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

/** Foto fija que le toca a una entrada según el slug (siempre la misma, y entradas distintas no quedan todas iguales). */
function fijaDeEntrada(e: Entrada) {
  let h = 0;
  for (const c of e.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GALERIA[h % GALERIA.length].id;
}

/**
 * Foto de portada de una entrada (fija o subida por Ceci): la que eligió, o si
 * no eligió, la fija que le toca.
 */
export function fotoDeEntrada(e: Entrada): FotoRef {
  return fotoValida(e.data.imagen) ? e.data.imagen : fijaDeEntrada(e);
}

/**
 * Atributos src (y onerror) de la portada (`ancha`) o de la tarjeta, para usar
 * con spread en el <img>. Si la foto es de las subidas y Ceci la borra, el .md
 * vuelve a la automática con un commit; hasta que termina ese deploy, el
 * onerror cambia una sola vez a la fija que le toca a la entrada.
 */
export function imgDeEntrada(e: Entrada, ancha: boolean): { src: string; onerror?: string } {
  const ruta = ancha ? rutaCabecera : rutaFoto;
  const f = fotoDeEntrada(e);
  if (!fotoSubida(f)) return { src: ruta(f) };
  return { src: ruta(f), onerror: `this.onerror=null;this.src='${ruta(fijaDeEntrada(e))}'` };
}

/** Minutos de lectura aproximados (200 palabras por minuto). */
export const minutosDeLectura = (cuerpo: string | undefined) =>
  Math.max(1, Math.round((cuerpo || '').split(/\s+/).filter(Boolean).length / 200));
