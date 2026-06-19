---
name: skincare-seo-local
description: SEO y posicionamiento local para Cecilia Gutiérrez · Cosmetología Médica (Uruguay — Montevideo y San José). Activá esta skill para optimizar meta tags, títulos, descripciones, datos estructurados (schema), sitemap, performance y para planear/escribir el blog con foco en búsquedas reales. Triggers — "mejorá el SEO", "metadatos de esta página", "escribamos un artículo del blog", "schema de negocio", "que aparezca en Google", "palabras clave".
---

# SEO local — Cecilia Gutiérrez · Cosmetología Médica

## Objetivo

Que personas de Montevideo y San José que buscan cosmetología médica / cuidado profesional de
la piel (consultas, peelings, mesoterapia, despigmentantes, tratamientos faciales y corporales)
encuentren a Ceci.

## Checklist técnico

- **Cada página** define `title`, `description` y `path` vía props de `Base.astro`. Títulos
  < 60 caracteres, descripciones 140–160, con beneficio + ubicación cuando aplique.
- **JSON-LD** (`Base.astro`): `HealthAndBeautyBusiness`, `areaServed` Montevideo / San José /
  Uruguay, `founder` con `jobTitle`. Mantener actualizado.
- **Sitemap** por `@astrojs/sitemap` (`/sitemap-index.xml`); `public/robots.txt` lo apunta. Al
  fijar el dominio real, actualizá `site` en `astro.config.mjs` y la URL del sitemap.
- **Open Graph** ya está en `Base.astro`. Cuando haya imagen de marca, sumá OG image (1200×630)
  en `public/` + meta `og:image`.
- **Performance:** sitio estático y liviano; no sumar JS/fuentes innecesarias.
- **Idioma:** `lang="es-UY"`.

## Palabras clave (UY)

- Locales: "cosmetóloga Montevideo", "cosmetología médica San José", "tratamientos faciales
  Montevideo".
- Por servicio: "peeling químico Montevideo", "mesoterapia facial Uruguay", "microneedling",
  "tratamiento despigmentante manchas", "radiofrecuencia facial", "limpieza facial profunda".
- De intención: "cómo cuidar mi piel", "rutina de skincare", "qué tratamiento necesito para
  manchas/acné/flacidez".

## Blog (motor de SEO orgánico)

- Artículos en `src/content/blog/*.md` (frontmatter: `titulo`, `descripcion`, `fecha`, `autora`,
  `publicado`).
- Temas con tracción y autoridad: cuidado por estación en Uruguay, cómo elegir protector solar,
  qué esperar de un peeling, mitos del skincare, cómo leer una etiqueta.
- Respetar `skincare-legal-guardrails` (sin prometer curas/garantías) y la voz de
  `skincare-brand-voice`. Cerrá con un CTA a la consulta de valoración.

## Entrega

Al optimizar, reportá qué meta cambiaste, qué keyword apuntás y por qué. Al escribir un
artículo, entregá título + descripción + cuerpo en Markdown listo para `src/content/blog/`.
