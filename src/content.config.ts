import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Blog y novedades: cada entrada es un .md en src/content/blog/.
// `tipo` separa las notas largas de las entradas cortas (novedades y tips).
// Cómo publicar una novedad: ver PUBLICAR-NOVEDADES.md en la raíz.
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    titulo: z.string(),
    descripcion: z.string(),
    fecha: z.coerce.date(),
    autora: z.string().default('Ceci'),
    // nota = artículo largo · novedad = tendencia o noticia corta · tip = recomendación práctica
    tipo: z.enum(['nota', 'novedad', 'tip']).default('nota'),
    // false = borrador: no se publica (solo se ve con `npm run dev`).
    publicado: z.boolean().default(true),
    // Foto de portada: un id de la galería (src/data/galeria-newsletter.ts). Si
    // falta, la página elige una de la galería según la entrada.
    imagen: z.string().optional(),
  }),
});

export const collections = { blog };
