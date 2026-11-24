import { getCollection, type CollectionEntry } from 'astro:content';
import { GALERIA, fotoValida, type FotoId } from '../data/galeria-newsletter';

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

/**
 * Foto de portada de una entrada (id de la galería): la que eligió Ceci, o si
 * no eligió, una de la galería que depende del slug (siempre la misma para esa
 * entrada, y entradas distintas no quedan todas con la misma foto).
 */
export function fotoDeEntrada(e: Entrada): FotoId {
  if (fotoValida(e.data.imagen)) return e.data.imagen;
  let h = 0;
  for (const c of e.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return GALERIA[h % GALERIA.length].id;
}

/** Minutos de lectura aproximados (200 palabras por minuto). */
export const minutosDeLectura = (cuerpo: string | undefined) =>
  Math.max(1, Math.round((cuerpo || '').split(/\s+/).filter(Boolean).length / 200));
