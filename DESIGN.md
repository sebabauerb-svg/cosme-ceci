---
name: Cecilia Gutiérrez · Cosmetología Médica
description: Cuidado de la piel boutique con criterio clínico — calma, confianza y honestidad.
colors:
  ink: "#2a302b"
  ink-soft: "#55605a"
  cream: "#faf6f0"
  cream-deep: "#f3ece1"
  sand: "#e7dccd"
  sage: "#6e7f6a"
  sage-deep: "#4f5d4c"
  clay: "#c0805f"
  clay-deep: "#a76a4b"
  white: "#ffffff"
  whatsapp: "#25d366"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.4rem, 6vw, 4rem)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.9rem, 4.2vw, 2.9rem)"
    fontWeight: 500
    lineHeight: 1.12
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.25rem, 2.4vw, 1.6rem)"
    fontWeight: 500
    lineHeight: 1.12
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.05rem"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Inter, system-ui, sans-serif"
    fontSize: "0.78rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.18em"
rounded:
  sm: "10px"
  md: "18px"
  pill: "999px"
spacing:
  card: "clamp(1.5rem, 3vw, 2.25rem)"
  section: "clamp(4rem, 9vw, 7.5rem)"
  gutter: "clamp(1.25rem, 5vw, 2.5rem)"
components:
  button-primary:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.white}"
    rounded: "{rounded.pill}"
    padding: "0.9rem 1.6rem"
  button-primary-hover:
    backgroundColor: "{colors.clay-deep}"
    textColor: "{colors.white}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "0.9rem 1.6rem"
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "#06351a"
    rounded: "{rounded.pill}"
    padding: "0.9rem 1.6rem"
  card:
    backgroundColor: "{colors.white}"
    rounded: "{rounded.md}"
    padding: "{spacing.card}"
---

# Design System: Cecilia Gutiérrez · Cosmetología Médica

## 1. Overview

**Creative North Star: "El consultorio sereno"**

Un espacio clínico que se siente cálido, no estéril. La marca vive en el cruce entre el
rigor de la cosmetología médica y la calma de un consultorio boutique con luz natural y
materiales nobles. El sistema transmite criterio profesional —se evalúa antes de
recomendar— sin caer ni en el rosa-spa cliché ni en el azul-blanco hospitalario. La
autoridad clínica se gana con claridad, orden y honestidad, no con frialdad ni con
marketing de promesa.

La densidad es generosa: mucho aire, ritmo pausado, tipografía con carácter. La paleta
salvia / arcilla / crema hace el trabajo de personalidad; el resto es restraint editorial
y legibilidad. Nada de adornos que abaraten la marca, nada de urgencia ni de venta
agresiva. El camino a agendar (WhatsApp) está siempre claro y a mano, porque la mayoría
llega desde el teléfono.

Este sistema rechaza explícitamente: el spa rosa/dorado/floral, la clínica fría y
hospitalaria, la estética de promesa-milagro y antes-después, y el look de SaaS genérico
de IA (gradientes morados, cards idénticas en grilla, eyebrow en cada sección).

**Key Characteristics:**
- Calidez clínica: profesional sin ser frío.
- Paleta natural comprometida (salvia, arcilla, crema), nunca rosa-spa.
- Tipografía serif + sans con contraste real (Fraunces + Inter).
- Plano por defecto; la profundidad aparece solo en respuesta a una interacción.
- Mobile-first, con el CTA de WhatsApp siempre disponible.

## 2. Colors

Una paleta natural y terrosa: verdes apagados de salvia, un cálido de arcilla para la
acción, y una base crema que reemplaza al blanco puro para suavizar la lectura.

### Primary
- **Salvia** (#6e7f6a): acento primario de marca. Eyebrows, enlaces en hover, foco,
  detalles. Es la voz calma y vegetal del sistema.
- **Salvia profunda** (#4f5d4c): variante oscura para hover de enlaces y texto sobre
  fondos claros cuando se busca énfasis sereno.

### Secondary
- **Arcilla** (#c0805f): el cálido de acción. Reservado para CTAs primarios (botón
  "Agendar consulta") y acentos puntuales. Su escasez le da fuerza.
- **Arcilla profunda** (#a76a4b): hover del CTA primario.

### Tertiary
- **Verde WhatsApp** (#25d366): exclusivo del botón de WhatsApp, con texto verde muy
  oscuro (#06351a). No se usa en ningún otro contexto de marca.

### Neutral
- **Tinta** (#2a302b): texto principal, un verde-carbón (no negro puro). Sobre crema da
  contraste alto y cálido.
- **Tinta suave** (#55605a): texto secundario y párrafos. Mantener para cuerpo solo
  cuando el contraste sobre el fondo siga ≥4.5:1.
- **Crema** (#faf6f0): fondo principal de página.
- **Crema profunda** (#f3ece1): fondo de secciones alternas (`.section--alt`).
- **Sand** (#e7dccd): bordes suaves, divisores y contorno de tarjetas.
- **Blanco** (#ffffff): superficie de tarjetas sobre la crema.

### Named Rules
**La Regla de la Arcilla Escasa.** La arcilla (#c0805f) es el color de la acción, no de la
decoración. Se reserva para el CTA primario y acentos contados; si aparece en todos lados
deja de significar "hacé clic acá". La salvia carga la personalidad; la arcilla, la
intención.

**La Regla del Carbón, no Negro.** El texto nunca es #000. La tinta verde-carbón (#2a302b)
sobre crema mantiene la calidez del sistema; el negro puro lo vuelve frío y genérico.

## 3. Typography

**Display Font:** Fraunces (con fallback Georgia, serif)
**Body Font:** Inter (con fallback system-ui, Segoe UI, sans-serif)

**Character:** Un serif con alma (Fraunces, con su contraste óptico y carácter editorial
cálido) contra un sans neutral y legible (Inter). El contraste serif/sans hace el trabajo;
los títulos llevan peso 500 y tracking ligeramente cerrado (-0.01em) para sentirse
compuestos, no estridentes.

### Hierarchy
- **Display / h1** (500, clamp 2.4–4rem, lh 1.12): título de hero y aperturas de página.
- **Headline / h2** (500, clamp 1.9–2.9rem, lh 1.12): títulos de sección.
- **Title / h3–h4** (500, clamp 1.25–1.6rem): subtítulos, nombres de tratamientos y
  modalidades (h4 en serif, ~1.08rem).
- **Body** (400, 1.05rem, lh 1.65): párrafos en tinta suave; mantener 60–75ch de ancho
  (`.lead` ya topa en 60ch).
- **Label / eyebrow** (600, 0.78rem, tracking 0.18em, mayúsculas): kicker en salvia sobre
  los títulos de sección; el grupo de tratamientos usa la misma forma en arcilla.

### Named Rules
**La Regla del Kicker Deliberado.** El eyebrow en mayúsculas con tracking es un elemento de
marca, no relleno. Úsalo como sistema consciente (kicker de sección en salvia, grupo en
arcilla), no como reflejo encima de cada bloque. Si aparece en absolutamente todas las
secciones, deja de ser voz y se vuelve andamiaje.

## 4. Elevation

Plano por defecto. Las superficies descansan sobre bordes finos color sand (#e7dccd), no
sobre sombras. La profundidad es una **respuesta a la interacción**: los botones se elevan
2px en hover, y existe una sombra difusa cálida (`--shadow`) reservada para elementos que
de verdad necesiten despegarse (por ejemplo media destacada). El nav fijo usa un blur de
fondo sutil (backdrop-filter) como única concesión a la profundidad ambiental.

### Shadow Vocabulary
- **Difusa de marca** (`box-shadow: 18px 18px 50px -28px rgba(42,48,43,0.35)`): sombra
  cálida y direccional para elementos destacados puntuales. Usar con moderación.
- **Elevación de CTA** (`box-shadow: 0 10px 24px -12px rgba(167,106,75,0.8)`): halo cálido
  bajo el botón primario de arcilla, refuerza que es la acción principal.

### Named Rules
**La Regla del Plano en Reposo.** Las superficies son planas en reposo; la sombra solo
aparece como respuesta a un estado (hover, foco, elevación intencional). Una página llena
de cards con sombra constante traiciona la calma del sistema.

## 5. Components

### Buttons
- **Shape:** pastilla completa (radius 999px).
- **Primary:** fondo arcilla (#c0805f), texto blanco, padding 0.9rem 1.6rem, con halo
  cálido. Es el botón "Agendar consulta" / "Agendá tu valoración".
- **Hover / Focus:** `translateY(-2px)` + arcilla profunda (#a76a4b) en primary; foco
  visible global con outline salvia de 2px y offset 3px.
- **Ghost:** transparente, texto tinta, borde sand; en hover el borde pasa a salvia y el
  texto a salvia profunda.
- **WhatsApp:** verde #25d366 con texto verde muy oscuro; exclusivo de acciones de
  WhatsApp.

### Cards / Containers
- **Corner Style:** 18px (`--radius`); listas internas 10px (`--radius-sm`).
- **Background:** blanco (#ffffff) sobre la crema de página.
- **Shadow Strategy:** ninguna en reposo; ver Elevation.
- **Border:** 1px sólido sand (#e7dccd).
- **Internal Padding:** clamp(1.5rem, 3vw, 2.25rem).

### Navigation
- **Style:** header sticky, fondo crema translúcido (rgba 0.85) con backdrop-blur 12px,
  borde inferior sand. Marca con monograma circular en degradé arcilla→salvia.
- **Links:** Inter 0.95rem peso 500, tinta; hover en salvia profunda.
- **CTA:** botón primario compacto en el extremo derecho.
- **Mobile (≤980px):** se ocultan links y CTA; aparece el toggle de hamburguesa y un menú
  desplegable con borde superior sand.

### Signature: Monograma de marca
Círculo de 40px con las iniciales en Fraunces sobre un degradé radial arcilla→salvia
(`radial-gradient(circle at 32% 30%, var(--clay), var(--sage))`), texto crema. Es el sello
visual recurrente del sistema; resume la paleta entera en un solo elemento.

## 6. Do's and Don'ts

### Do:
- **Do** usar la crema (#faf6f0) como fondo, nunca blanco puro de página; el blanco se
  reserva para las tarjetas.
- **Do** reservar la arcilla (#c0805f) para el CTA y acentos contados (La Regla de la
  Arcilla Escasa).
- **Do** mantener el texto en tinta verde-carbón (#2a302b), no negro puro.
- **Do** verificar contraste: cuerpo ≥4.5:1, texto grande ≥3:1; si la tinta suave
  (#55605a) queda justa sobre crema, subir hacia la tinta plena.
- **Do** dejar las superficies planas en reposo y elevar solo en hover/foco.
- **Do** tener el CTA de WhatsApp/agenda siempre accesible, pensado primero para móvil.

### Don't:
- **Don't** caer en el spa rosa/dorado/floral femenino cliché. La paleta salvia/arcilla
  existe precisamente para evitarlo.
- **Don't** virar a clínica fría/hospitalaria: nada de azul médico ni blanco hospital.
- **Don't** usar estética de promesa-milagro, urgencia ni antes-después (choca con el
  blindaje legal: piel sana, no es acto médico, sin curas garantizadas).
- **Don't** caer en SaaS genérico de IA: gradientes morados, cards idénticas en grilla,
  eyebrow en cada sección.
- **Don't** usar `border-left`/`border-right` >1px como franja de color de acento; usar
  bordes completos sand o tintes de fondo.
- **Don't** usar texto en gradiente (`background-clip: text`) ni glassmorphism decorativo
  (el blur del nav es la única excepción intencional).
- **Don't** repetir el kicker en mayúsculas encima de cada sección como reflejo; es un
  sistema deliberado, no andamiaje.
