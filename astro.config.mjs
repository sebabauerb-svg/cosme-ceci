import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// IMPORTANTE: cuando tengas el dominio definitivo, cambiá `site`.
// Se usa para el sitemap, las URLs canónicas y las etiquetas Open Graph.
export default defineConfig({
  // URL de producción actual. Cuando se conecte un dominio propio
  // (ej. cgcosmetologiamedica.uy), cambiar acá y en public/robots.txt.
  site: 'https://cosme-ceci.vercel.app',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
