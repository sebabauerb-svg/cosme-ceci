---
name: skincare-deploy-vercel
description: Build, verificación pre-publicación y despliegue del sitio de Cecilia Gutiérrez · Cosmetología Médica en Vercel. Activá esta skill cuando haya que publicar el sitio, preparar un deploy, conectar el dominio, o correr el checklist de calidad antes de producción. Triggers — "publiquemos el sitio", "preparemos el deploy", "subilo a Vercel", "checklist antes de publicar", "conectar el dominio". Nunca publica sin pasar el checklist ni con datos provisorios sin avisar.
---

# Deploy — Cecilia Gutiérrez · Cosmetología Médica (Vercel)

## Pre-flight: checklist (correr SIEMPRE antes de publicar)

1. **Build limpio:** `npm run build` sin errores ni warnings nuevos.
2. **Datos reales, no placeholders.** Revisá `src/data/site.ts`: ningún campo `CONFIRMAR`
   crítico debe quedar provisorio en producción (WhatsApp, mail, IG, dominio). Si quedan,
   **avisá a Sebas/Ceci explícitamente** — no lo dejes pasar en silencio.
3. **Foto de Ceci** colocada (o el placeholder asumido conscientemente).
4. **Copy revisada** con `skincare-legal-guardrails` (sin curas/garantías; aviso legal presente).
5. **Dominio:** `site` en `astro.config.mjs` y el sitemap en `public/robots.txt` apuntan al
   dominio definitivo.
6. **Links:** WhatsApp abre con mensaje pre-cargado; navegación interna funciona desde `/blog`
   y `/aviso-legal` (usan `/#id`).

## Despliegue en Vercel

Astro **estático**, sin config especial:
- **Framework preset:** Astro (autodetectado).
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`

Opciones: conectar el repo de GitHub a Vercel (deploy automático en cada push, recomendado), o
Vercel CLI (`vercel` / `vercel --prod`).

> En este entorno hay tools de Vercel vía MCP (`deploy_to_vercel`, `get_deployment`,
> `get_deployment_build_logs`, `check_domain_availability_and_price`). Si piden publicar,
> proponé usarlas y **confirmá antes de ejecutar** (acción de cara al público).

## Dominio

- Verificá disponibilidad/precio antes de comprometerlo.
- Sugerencias: `cgcosmetologiamedica.uy` / `.com`, o el que prefiera Ceci. Al fijarlo, actualizá
  `astro.config.mjs` y `robots.txt`.

## Post-deploy

1. Abrí la URL en mobile: hero, CTA de WhatsApp, navegación, modalidades, tratamientos, `/blog`,
   `/aviso-legal`.
2. Confirmá que el WhatsApp flotante y los CTAs abren el número correcto.
3. PageSpeed / Lighthouse (debería dar muy alto al ser estático).
4. Reportá la URL, pendientes y cualquier `CONFIRMAR` abierto.

## Regla

Publicar es de cara al público: confirmá con Sebas/Ceci antes del deploy a producción. No
publiques con datos de contacto provisorios sin avisarlo.
