---
name: skincare-brand-voice
description: Voz de marca y redacción de copy para Cecilia Gutiérrez · Cosmetología Médica (práctica boutique de cuidado de la piel, Uruguay). Activá esta skill cuando haya que escribir o reescribir textos del sitio o materiales: titulares, descripciones de modalidades y tratamientos, FAQ, mensajes de WhatsApp, copy de secciones. Triggers — "escribí el hero", "mejorá este texto", "redactá la sección de X", "armá un mensaje para WhatsApp". Mantiene tono y posicionamiento boutique. La copy con afirmaciones sobre piel/resultados pasa después por skincare-legal-guardrails.
---

# Voz de marca — Cecilia Gutiérrez · Cosmetología Médica

## Quién habla

Ceci: Cosmetóloga Médica, criteriosa, cálida y profesional. Atención boutique: exclusiva,
pausada y personalizada. Le habla a alguien que valora el cuidado serio, basado en evidencia,
por encima de las recetas mágicas.

## Tono

- **Español rioplatense (voseo).** "tenés", "diseñamos", "tu piel".
- **Profesional y cercano.** Autoridad clínica con calidez; nada de lenguaje de influencer ni
  de promesas exageradas.
- **Pausado y preciso.** Frases claras. Cuando hay un activo o tecnología, se explica para qué
  sirve, sin abrumar.
- **Centrado en la persona.** "Cada piel cuenta una historia diferente." El eje es la
  personalización y el criterio, no el descuento ni la urgencia.

## Mensajes núcleo (usar y variar)

- "Cuidado profesional para una piel sana, equilibrada y luminosa."
- "Porque una piel saludable siempre será la mejor versión de una piel bonita."
- "No todas las pieles necesitan lo mismo. Ahí está la diferencia."
- Pilares: **Personalización · Seguridad · Resultados.**

## Qué SÍ

- Hablar de evaluación profesional, protocolos a medida, evidencia, acompañamiento.
- Mantener el registro clínico de la marca: "Cosmetología Médica", "diagnóstico", "evaluación
  clínica", "historia clínica estética" (es una decisión tomada; ver `skincare-legal-guardrails`).
- CTAs claros y elegantes: "Agendá tu valoración", "Coordinemos tu consulta".

## Qué NO

- Prometer curar enfermedades o garantizar resultados.
- Estadísticas inventadas ni falsa urgencia ("últimas horas").
- Listar precios de tratamientos (solo la Consulta tiene precio visible; el resto "según
  protocolo").
- Presentar la práctica como que "no vende nada": el ángulo de consumo consciente es solo de la
  modalidad **Skincare Inteligente**.

## Formato de entrega

Entregá la versión recomendada y, si suma, 1 alternativa. La copy con afirmaciones sobre
piel/resultados se valida con `skincare-legal-guardrails`. El texto final vive en `src/data/`
o en el `.astro` según corresponda (ver `skincare-web-builder`).
