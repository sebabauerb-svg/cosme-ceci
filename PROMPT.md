# Prompt maestro — Cecilia Gutiérrez · Cosmetología Médica

> **Brief único del proyecto.** Leelo (o pegalo) al inicio de cualquier sesión de Claude para
> entender el negocio, la voz y la arquitectura antes de tocar el código. Las skills en
> `.claude/skills/` automatizan partes de esto.

---

## 0. Encargo en una línea

Construir y mantener el sitio web de **Cecilia Gutiérrez · Cosmetología Médica**: una práctica
boutique de cuidado de la piel en Montevideo y San José (Uruguay), que presenta su filosofía,
sus modalidades de atención, su catálogo de tratamientos y capta consultas de valoración.

## 1. La marca

- **Marca paraguas:** **Cecilia Gutiérrez · Cosmetología Médica**.
- **Profesional:** Cecilia Gutiérrez (Ceci), Cosmetóloga Médica. Atiende en Montevideo y San José.
- **Lema:** *"Cuidado profesional para una piel sana, equilibrada y luminosa."*
- **Cierre de marca:** *"Porque una piel saludable siempre será la mejor versión de una piel bonita."*
- **Posicionamiento:** boutique — exclusivo, pausado, minuciosamente personalizado, basado en
  evidencia. Pilares: **Personalización · Seguridad · Resultados**.
- **Contacto (del dossier, CONFIRMAR):** IG `@cgcosmetologiamedica` · Cel `098 19 20 50`.

## 2. Modalidades de atención (4)

1. **Consulta Presencial** — evaluación clínica y diagnóstico; historia clínica estética +
   diseño del primer protocolo. **$1.800** (se bonifica si contrata protocolo el mismo día).
2. **Consulta Virtual** — "Cosmetología Médica sin límites"; videollamada HD + rutina
   domiciliaria. Para fuera de Mvd/SJ o seguimiento continuo.
3. **Asesoramiento Skincare Inteligente** — optimización del nécessaire / consumo consciente:
   revisar lo que ya tiene, corregir errores, reordenar la rutina.
4. **El Club de las Estaciones** — membresía anual; una consulta diagnóstica por estación +
   adaptación del recetario domiciliario.

> Nota: "Skincare Inteligente" dejó de ser la marca principal; ahora es **una modalidad**.

## 3. Tratamientos (catálogo)

- **Faciales · Limpieza y Renovación:** Higiene Profunda con Extracciones, Microdermoabrasión
  (Puntas de Diamante), Dermaplaning, Peelings Químicos.
- **Faciales · Hidratación y Revitalización:** Hidratación Shock, Mesoterapia Facial, Meso Lips.
- **Tecnología · Rejuvenecimiento:** Microneedling, Radiofrecuencia Facial, Luz Pulsada Intensa
  (IPL), Tratamientos Despigmentantes.
- **Capilares:** Radiofrecuencia Capilar, Mesoterapia Capilar.
- **Corporales:** Ultracavitación & Mesoterapia Corporal, IPL Corporal.

Los valores de referencia están en `anexo_tarifas_cecilia_gutierrez_v4.pdf` y en comentarios de
`src/data/tratamientos.ts`.

## 4. Decisiones tomadas (junio 2026)

- **Precios:** se muestra **solo el valor de la Consulta** ($1.800). Los tratamientos van con
  "valor según protocolo definido en consulta" (posicionamiento boutique). No listar precios
  por tratamiento en la web.
- **Voz / lenguaje clínico:** se usa **la voz del dossier tal cual** — "Cosmetología Médica",
  "diagnóstico", "evaluación clínica", "historia clínica estética". (Se evaluó suavizar por el
  análisis de riesgo legal de los docs de estrategia; Sebas optó por mantener la voz real.)
  Igual conviene validar el alcance profesional con un abogado/MSP antes de operar.

## 5. Stack y arquitectura

- **Astro 5** estático, sin framework de UI. Deploy objetivo: **Vercel**.
- Datos editables (lo que toca Ceci):
  - `src/data/site.ts` — marca, contacto, redes, enlaces, WhatsApp + `whatsappLink()`.
  - `src/data/modalidades.ts` — las 4 modalidades (Consulta $1.800, Asesoramiento $1.600, Club).
  - `src/data/tratamientos.ts` — catálogo por categorías (sin precios visibles).
  - `src/data/club.ts` — plan detallado del Club ($4.800/año, 4 cuotas de $1.200, 4 estaciones).
  - `src/data/imagenes.ts` — slots de imágenes (hero opcional + galería "El espacio"). Ver IMAGENES.md.
- `src/layouts/Base.astro` — head, SEO, Open Graph, JSON-LD.
- `src/components/*.astro` — Nav, Hero, Filosofia, ComoFunciona (Mi forma de trabajar),
  Modalidades, Tratamientos, ClubEstaciones, SobreCeci, EspacioGaleria, Testimonios, Reserva,
  FAQ, Footer, WhatsappFloat. Foto de Ceci en `public/ceci.jpg`.
- `src/pages/` — `index.astro`, `aviso-legal.astro`, `blog/`. `src/content/blog/*.md` (Fase 2).
- `src/styles/global.css` — sistema de diseño (tokens).

## 6. Diseño

- **Tono:** natural, premium, calmo, clínico-confiable. Sin rosa cliché.
- **Paleta:** crema (`--cream`), salvia (`--sage`), arcilla (`--clay`), verde-carbón (`--ink`).
- **Tipografía:** Fraunces (serif, títulos) + Inter (sans, cuerpo).
- **Voz de copy:** español rioplatense (voseo), profesional y cercano, foco en personalización
  y criterio. Ver `skincare-brand-voice`.

## 7. Pendiente de Ceci / Sebas

- Confirmar contacto: WhatsApp exacto, mail, IG (provisorios del dossier ya cargados).
- Foto profesional de Ceci (placeholder en `SobreCeci.astro`).
- Confirmar precios y planes (Consulta, Club, tratamientos).
- Link de agenda (Calendly) y/o pago (Mercado Pago), si los usa.
- Testimonios reales (con autorización).
- Dominio definitivo → actualizar `astro.config.mjs` y `public/robots.txt`.

## 8. Cómo trabajar este repo

Empezá por **`skincare-orchestrator`** (entiende y delega). Para copy, `skincare-brand-voice`.
Para construir, `skincare-web-builder`. Para SEO/blog, `skincare-seo-local`. Para publicar,
`skincare-deploy-vercel`. La skill `skincare-legal-guardrails` mantiene los límites de seguridad
acordados (sin prometer cura de enfermedades, derivación responsable).
