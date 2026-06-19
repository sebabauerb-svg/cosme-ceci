import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// IMPORTANTE: cuando tengas el dominio definitivo, cambiá `site`.
// Se usa para el sitemap, las URLs canónicas y las etiquetas Open Graph.
export default defineConfig({
  // Dominio de producción.
  site: 'https://cgcosmetologiamedica.com',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
