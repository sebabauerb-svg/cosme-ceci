# Cecilia Gutiérrez · Cosmetología Médica — sitio web

Sitio de **Cecilia Gutiérrez · Cosmetología Médica**, práctica boutique de cuidado de la piel
en Montevideo y San José (Uruguay). Hecho en [Astro](https://astro.build): estático, rápido y
con muy buen SEO.

## Empezar

```bash
npm install      # instalar dependencias (una sola vez)
npm run dev      # servidor local en http://localhost:4321
npm run build    # generar el sitio para producción (carpeta dist/)
npm run preview  # previsualizar el build de producción
```

## ¿Dónde edito el contenido?

Casi todo se cambia desde tres archivos, sin tocar código:

- **`src/data/site.ts`** — marca, contacto (WhatsApp, mail, Instagram) y enlaces. Los campos
  `CONFIRMAR` tienen valores provisorios tomados del dossier.
- **`src/data/modalidades.ts`** — las 4 modalidades de atención (Consulta Presencial, Virtual,
  Asesoramiento Skincare Inteligente, Club de las Estaciones). Solo la Consulta muestra precio.
- **`src/data/tratamientos.ts`** — catálogo de tratamientos por categoría (sin precios visibles).

Los textos de cada sección están en `src/components/*.astro`. El blog son archivos `.md` en
`src/content/blog/`.

## Pendientes de Ceci (antes de publicar)

- [ ] Confirmar WhatsApp, mail e Instagram en `site.ts`.
- [ ] Foto profesional (reemplazar el placeholder en `SobreCeci.astro`).
- [ ] Confirmar el valor de la Consulta y los planes del Club.
- [ ] Testimonios reales (con autorización).
- [ ] Dominio definitivo (actualizar `astro.config.mjs` y `public/robots.txt`).

## Decisiones de contenido

- **Marca paraguas:** Cecilia Gutiérrez · Cosmetología Médica. "Skincare Inteligente" es una de
  las modalidades, no la marca.
- **Voz:** la del dossier (Cosmetología Médica, diagnóstico, evaluación clínica). Detalle y
  límites en `PROMPT.md` y en la skill `skincare-legal-guardrails`.
- **Precios:** solo la Consulta ($1.800) visible; tratamientos "según protocolo".

## Estructura

```
src/
  data/         site.ts, modalidades.ts, tratamientos.ts   ← edita Ceci
  layouts/      Base.astro                                 ← <head>, SEO, JSON-LD
  components/   secciones de la home
  pages/        index, aviso-legal, blog/
  content/      blog/*.md
  styles/       global.css                                 ← colores y tipografía
public/         favicon, robots.txt, (futuras imágenes)
.claude/skills/ skills del proyecto (orquestador, legal, copy, build, SEO, deploy)
PROMPT.md       brief maestro del proyecto
```

Documentos fuente de Ceci (no se publican): el dossier institucional en PDF, el anexo de tarifas
y los docs de estrategia en `.docx`.

## Trabajar con Claude

Empezá las sesiones con la skill **`skincare-orchestrator`**; ella deriva al resto. El brief
completo está en [`PROMPT.md`](./PROMPT.md).
