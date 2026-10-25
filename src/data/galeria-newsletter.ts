/**
 * Fotos fijas para el mail del newsletter: Ceci elige una para la cabecera
 * (siempre lleva una) y, si quiere, una para cada novedad. Los archivos los
 * genera scripts/galeria-newsletter.py en public/email/galeria/ en dos tamaños:
 * <id>-ancha.jpg (cabecera, 1200x520) y <id>.jpg (novedad, 480x360).
 *
 * Para sumar fotos: ver el comentario del script. Si algún día hace falta subir
 * fotos desde el panel, la opción pensada es Vercel Blob.
 */
export const GALERIA = [
  { id: 'portada', etiqueta: 'Portada del sitio' },
  { id: 'espacio-1', etiqueta: 'El espacio (1)' },
  { id: 'espacio-2', etiqueta: 'El espacio (2)' },
  { id: 'espacio-3', etiqueta: 'El espacio (3)' },
] as const;

export type FotoId = (typeof GALERIA)[number]['id'];
export const CABECERA_POR_DEFECTO: FotoId = 'portada';

export const fotoValida = (v: unknown): v is FotoId => GALERIA.some((f) => f.id === v);

/** Rutas relativas al sitio (se completan con la base pública al armar el mail). */
export const rutaCabecera = (id: FotoId) => `/email/galeria/${id}-ancha.jpg`;
export const rutaFoto = (id: FotoId) => `/email/galeria/${id}.jpg`;
export const RUTA_LOGO = '/email/logo-cg.png';
export const RUTA_FIRMA = '/email/ceci-firma.jpg';
