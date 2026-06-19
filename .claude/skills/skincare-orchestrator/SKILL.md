---
name: skincare-orchestrator
description: Punto de entrada del proyecto web de Cecilia Gutiérrez · Cosmetología Médica (sitio Astro, práctica boutique en Montevideo y San José). Activá esta skill al inicio de TODA sesión de trabajo sobre el sitio, o cuando el pedido involucre más de un tipo de tarea (copy + diseño + legal + deploy). Entiende el encargo, lo divide y delega a la skill correcta. Triggers — "trabajemos en el sitio de Ceci", "agreguemos una sección", "revisá la web", "qué falta", "actualicemos las modalidades o tratamientos", "preparemos el deploy".
---

# Orquestador — Cecilia Gutiérrez · Cosmetología Médica

Sos el punto de entrada del sitio web de **Cecilia Gutiérrez · Cosmetología Médica**. Tu trabajo
es entender el pedido, protegerlo del scope creep y derivar a la skill correcta.

## Primero: contexto obligatorio

1. Leé `PROMPT.md` en la raíz si no tenés el contexto del negocio fresco.
2. Recordá lo que manda en este proyecto:
   - **Marca paraguas:** Cecilia Gutiérrez · Cosmetología Médica. "Skincare Inteligente" es
     **una de las 4 modalidades**, no la marca.
   - **Voz del dossier tal cual** (Cosmetología Médica, diagnóstico, evaluación clínica): no la
     suavices. Ver `skincare-legal-guardrails`.
   - **Precios:** solo la Consulta ($1.800) se muestra; tratamientos "según protocolo".
   - **Estructura:** Filosofía → Modalidades (4) → Tratamientos → Sobre Ceci → Reserva.

## Mapa de delegación

| Si el pedido es sobre… | Usá la skill |
|---|---|
| Textos, mensajes, tono, titulares, copy de una sección | `skincare-brand-voice` |
| Afirmaciones sobre piel/resultados, testimonios, "¿esto se puede decir?" | `skincare-legal-guardrails` |
| Componentes Astro, estructura, estilos, nueva sección/página | `skincare-web-builder` |
| Meta tags, SEO local, schema, blog, posicionamiento en Google | `skincare-seo-local` |
| Build, deploy, Vercel, dominio, checklist pre-publicación | `skincare-deploy-vercel` |

## Reglas de oro

- **Revisá la copy con la skill legal** antes de publicar afirmaciones sobre piel/resultados.
  No promete curas ni resultados garantizados.
- **No inventes datos de negocio.** Precios, WhatsApp exacto, testimonios y links los confirma
  Ceci. Si faltan, dejalos como `CONFIRMAR` en `src/data/` y avisá; no los inventes.
- **Editá datos, no hardcodees.** Contacto en `src/data/site.ts`; oferta en
  `src/data/modalidades.ts` y `src/data/tratamientos.ts`. Cambiá ahí, no en los componentes.
- **Scope primero.** Antes de sumar features (newsletter, e-commerce, agenda embebida),
  confirmá que lo pidió Ceci/Sebas.

## Flujo típico de una sesión

1. Entender el pedido y, si es ambiguo, hacer 1–2 preguntas concretas.
2. Verificar estado: `npm run build` corre limpio.
3. Delegar a la(s) skill(s) del mapa.
4. Si tocaste copy → pasar por la compuerta legal.
5. `npm run build` de nuevo y, si Ceci lo pide, deploy con `skincare-deploy-vercel`.
6. Reportar qué cambió y qué quedó pendiente de Ceci.
