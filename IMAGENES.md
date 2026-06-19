# Guía de imágenes — dónde van y qué medida

Dejá los archivos en la carpeta **`public/`** y completá el `src` correspondiente en
**`src/data/imagenes.ts`** (y la foto de Ceci ya está en `public/ceci.jpg`).

> Mientras un slot esté vacío, el sitio no se rompe: el hero muestra su composición abstracta
> y la galería muestra placeholders elegantes con la medida sugerida.

## Slots disponibles

| Dónde | Archivo sugerido | Medida (px) | Formato | En qué se ve |
|---|---|---|---|---|
| **Sobre mí** (ya cargada) | `public/ceci.jpg` | ~1200 × 1600 (vertical 3:4) | JPG/WEBP | Foto de Ceci. Ya integrada. |
| **Hero** (opcional) | `public/hero.jpg` | ~1200 × 1600 (vertical 3:4) | JPG/WEBP | Imagen grande de inicio. Si la dejás, reemplaza la composición abstracta. |
| **El espacio · imagen 1** | `public/espacio-1.jpg` | ~1000 × 1250 (vertical) | JPG/WEBP | Tile grande de la galería. |
| **El espacio · imagen 2** | `public/espacio-2.jpg` | ~1000 × 800 (apaisada) | JPG/WEBP | Tile superior derecho. |
| **El espacio · imagen 3** | `public/espacio-3.jpg` | ~1000 × 800 (apaisada) | JPG/WEBP | Tile inferior derecho. |

## Cómo activarlas

En `src/data/imagenes.ts`:

```ts
export const imagenes = {
  hero: { src: '/hero.jpg', alt: 'Cecilia Gutiérrez en su consultorio' },
  espacio: [
    { src: '/espacio-1.jpg', alt: 'Sala de tratamientos' },
    { src: '/espacio-2.jpg', alt: 'Detalle de tecnología' },
    { src: '/espacio-3.jpg', alt: 'Productos y activos' },
  ],
};
```

## Recomendaciones

- **Peso:** optimizá cada imagen a **menos de 300 KB** (podés usar squoosh.app o tinypng.com).
- **Luz:** natural, sin filtros fuertes, encuadre limpio.
- **Coherencia:** tonos cálidos/neutros combinan con la paleta (crema, salvia, arcilla).
- **`alt`:** describí brevemente qué se ve (ayuda al SEO y la accesibilidad).
- Podés sumar más imágenes a la galería agregando objetos al array `espacio` (toma las 3 primeras
  para la composición destacada).
