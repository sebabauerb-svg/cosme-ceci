import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import vercel from '@astrojs/vercel';

// IMPORTANTE: cuando tengas el dominio definitivo, cambiá `site`.
// Se usa para el sitemap, las URLs canónicas y las etiquetas Open Graph.
export default defineConfig({
  // Dominio de producción.
  site: 'https://cgcosmetologiamedica.com',
  // El sitemap deja afuera las páginas con noindex (transaccionales y 404) y el panel.
  // Los borradores del blog no se generan en el build, así que tampoco entran.
  integrations: [
    sitemap({
      filter: (page) => !/\/(admin|reservar|mi-turno|404)\/?$/.test(new URL(page).pathname),
    }),
  ],
  // Sitio estático + endpoints de servidor (las páginas siguen prerenderizadas;
  // solo /api/* corre en serverless, marcado con `export const prerender = false`).
  adapter: vercel(),
  build: {
    inlineStylesheets: 'auto',
  },
});
