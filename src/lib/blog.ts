import { getCollection, type CollectionEntry } from 'astro:content';

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
