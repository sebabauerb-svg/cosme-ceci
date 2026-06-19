/**
 * IMÁGENES DEL SITIO
 * ==================
 * Slots para las fotos de Ceci. Dejá los archivos en `public/` y completá el `src`
 * (ej: '/espacio-1.jpg'). Si un slot queda vacío:
 *   - el hero muestra su composición abstracta (no se rompe nada),
 *   - la galería "El espacio" muestra placeholders elegantes con la medida sugerida.
 *
 * Recomendaciones: JPG/WEBP optimizado (< 300 KB), buena luz natural.
 * Guía completa en IMAGENES.md (raíz del proyecto).
 */

export type Imagen = { src: string; alt: string };

export const imagenes = {
  /** Hero: imagen vertical ~3:4 (ej. 1200×1600). Vacío → composición abstracta. */
  hero: { src: '/hero.jpg', alt: 'Cecilia analizando la piel de una paciente en consulta' } as Imagen,

  /** Galería "El espacio": 3 a 6 imágenes del consultorio o tratamientos (~4:5). */
  espacio: [
    { src: '/espacio-1.jpg', alt: 'Tratamiento facial en proceso' },
    { src: '/espacio-2.jpg', alt: 'Productos y activos para el cuidado de la piel' },
    { src: '/espacio-3.jpg', alt: 'Cosméticos sobre piedra natural' },
  ] as Imagen[],
};
