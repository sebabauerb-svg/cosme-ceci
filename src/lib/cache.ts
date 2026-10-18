/**
 * Caché de CDN para páginas SSR públicas (home, /reservar).
 * La CDN de Vercel sirve la copia guardada hasta 60 s; después la sigue sirviendo
 * mientras pide una nueva en segundo plano (stale-while-revalidate). El navegador
 * no guarda copia propia, así un precio nuevo llega en ~1 minuto.
 */
export function cacheCdn(response: { headers: Headers }, segundos = 60) {
  response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  response.headers.set('CDN-Cache-Control', `public, s-maxage=${segundos}, stale-while-revalidate=600`);
}
