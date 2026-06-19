---
name: skincare-web-builder
description: Construcción y mantenimiento técnico del sitio Astro de Cecilia Gutiérrez · Cosmetología Médica. Activá esta skill para crear o editar componentes y páginas, agregar secciones, ajustar estilos, manejar los datos del sitio o resolver errores de build. Triggers — "agregá una sección de X", "creá una página", "cambiá el estilo de Y", "el build falla", "sumá un tratamiento o modalidad". Conoce la arquitectura del repo y las convenciones de diseño.
---

# Web builder — Cecilia Gutiérrez · Cosmetología Médica (Astro)

## Arquitectura del repo

Datos editables (lo que toca Ceci, sin tocar componentes):
- `src/data/site.ts` — marca (`site.marca`), contacto, redes, enlaces, WhatsApp +
  helper `whatsappLink()`. Campos provisorios marcados `CONFIRMAR`.
- `src/data/modalidades.ts` — las 4 modalidades de atención. Solo la Consulta muestra precio.
- `src/data/tratamientos.ts` — catálogo por categorías. **Los precios NO se renderizan**
  (decisión de negocio); van en `precioRef` solo como referencia interna.
- `src/data/club.ts` — plan detallado del Club de las Estaciones (sección `ClubEstaciones.astro`).
- `src/data/imagenes.ts` — slots de imágenes (hero opcional + galería "El espacio"). Con
  fallback elegante (`.media-ph`) cuando un slot está vacío. Guía en `IMAGENES.md`.

Código:
- `src/layouts/Base.astro` — `<head>`, SEO, Open Graph, JSON-LD, fuentes, script de `reveal`.
  Props: `title`, `description`, `path`. La marca se arma como `${marca.nombre} · ${marca.subtitulo}`.
- `src/components/*.astro` — Nav, Hero, Filosofia, ComoFunciona (Mi forma de trabajar),
  Modalidades, Tratamientos, SobreCeci, Testimonios, Reserva, FAQ, Footer, WhatsappFloat.
- `src/pages/` — `index.astro` (ensambla la home), `aviso-legal.astro`, `blog/`.
- `src/content/blog/*.md` + `src/content.config.ts` — colección de blog (Fase 2).
- `src/styles/global.css` — sistema de diseño (tokens, botones, tarjetas, utilidades).

## Convenciones

- **Colores:** usá los tokens de `:root` (`--ink`, `--cream`, `--sage`, `--clay`, `--sand`).
  No hardcodees colores.
- **Secciones:** `<section class="section">` (o `section--alt` para fondo alterno) + `.container`.
  Encabezado con `.eyebrow` + `<h2>`.
- **Animación:** `class="reveal"` en lo que aparece al hacer scroll (observer en `Base.astro`,
  respeta `prefers-reduced-motion`).
- **Botones:** `.btn` + `.btn--primary` / `.btn--ghost` / `.btn--wa`.
- **CTAs a WhatsApp:** siempre `whatsappLink(mensaje)`, `target="_blank" rel="noopener"`.
- **Navegación:** los links usan `/#id` para funcionar desde `/blog` y `/aviso-legal`. Si sumás
  sección con ancla, agregá el link en `Nav.astro` y `Footer.astro`.
- **Imágenes:** assets en `public/`. Hay placeholders `CONFIRMAR` (foto de Ceci) — reemplazar por
  `<img>` con `alt` descriptivo.
- **Responsive:** mobile-first; breakpoints ~980/860/760/560px.

## Reglas

- Sitio estático y liviano a propósito: no metas frameworks de UI ni dependencias pesadas sin
  motivo.
- Sumar una modalidad/tratamiento = editar `modalidades.ts` / `tratamientos.ts`, no el componente.
- Copy con peso de negocio → `skincare-brand-voice`; afirmaciones sobre piel/resultados →
  `skincare-legal-guardrails`.

## Verificación

Cerrá con `npm run build` (debe pasar limpio). En vivo: `npm run dev`. El render del panel de
preview puede fallar en algunos entornos; si pasa, confiá en el build + `preview_console_logs`.
