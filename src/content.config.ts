import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Colección de blog (Fase 2). Cada artículo es un .md en src/content/blog/
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    titulo: z.string(),
    descripcion: z.string(),
    fecha: z.coerce.date(),
    autora: z.string().default('Ceci'),
    publicado: z.boolean().default(true),
  }),
});

export const collections = { blog };
