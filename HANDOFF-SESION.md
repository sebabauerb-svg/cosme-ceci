# Handoff — estado del proyecto (actualizado 12/8/2026 · sesión seña + mobile)

## 🔴 Lo primero de la próxima sesión (actualizado 12/8 · noche)

**Todo está en producción** (`ecdede7`). Quedan dos cosas:

1. **Cargar `CRON_SECRET` en Vercel (Production)** — hasta que exista, el cron de
   recordatorios NO manda nada. Verificado en producción: hoy devuelve 401
   "secret no configurado", que es el fail-closed funcionando.
2. **Primera pasada por el panel de gestión con datos reales.** Se mergeó sin
   verificación end-to-end (acordado con Sebas): necesita base de datos y login,
   que no hay en local. Si algo falla, mirar primero la sincronía entre
   `sena_pagada` y el toggle `pagado` de la tabla de reservas.

**Astro 7 en producción** (`2da1987`): alertas de GitHub de 28 → 1. El build de
Astro 7 **ahora corre en la PC de Sebas** — el bloqueo de Windows App Control
desapareció, así que ya no hace falta el preview de Vercel para verificarlo.

## Lo anterior

**Verificar en vivo lo que no se pudo probar sin producción** (el flujo de seña
se mergeó a `main` el 12/8/2026, commit `08c273a`):

1. **Una reserva real de punta a punta** por el camino de transferencia, para
   ver los mails que salen (Resend) y el WhatsApp de confirmación del panel.
2. **Un pago de MercadoPago**: que el checkout cobre **$700** y que el webhook
   confirme el turno. Ojo: credenciales de producción, el pago es real.
3. Si algo sale distinto, mirar los logs de la función en Vercel.

## ✅ Novedades de esta sesión (12/8/2026)

- **Rediseño mobile de la home: EN PRODUCCIÓN** (`ea702ba`). Scroll de 18.165 px
  a 11.120 px con acordeones (`<details>`) y carruseles scroll-snap. Desktop
  intacto (verificado: categorías abiertas, grilla de 2 columnas, sin overflow).
- **Reservas — modelo de seña** (rama `claude/project-improvements-57cc24`,
  commit `1d9eb8f`, **sin mergear**):
  - La web cobra **$700 de seña**, no el total. Fuente de verdad:
    `src/lib/precios.ts` (`SENA_UYU`, `senaOnline`, `saldoEnConsulta`).
    `reservas.precio_uyu` guarda **la seña** — el webhook de MP valida contra
    esa columna, así que ambos lados salen de `senaOnline()`.
  - Camino transferencia: la web muestra los datos bancarios de
    `src/data/pago.ts` (cuenta BROU, titular **Maria Gutierrez** — es correcto,
    no es Cecilia) con el concepto ya armado ("Seña + nombre"), y arma el
    WhatsApp. Si el archivo se vacía, degrada solo (dice que Ceci pasa los datos).
  - **Política de cancelación** (24 h; después la seña no se reintegra) visible
    en el paso de confirmar, ANTES de pagar, y en los dos emails.
  - `src/data/sedes.ts`: direcciones de las dos sedes (San José: Treinta y Tres
    esq. Larrañaga, Escritorio Duca & Aldaz · Montevideo: Maldonado 1321/402).
    Van al mail de confirmación y al evento de Calendar.
  - **Email obligatorio** en `/reservar`: era la única forma de garantizar la
    confirmación con día y hora. El asunto del mail lleva fecha y hora.
  - **Admin**: al confirmar aparece "Avisar por WhatsApp" con el mensaje ya
    escrito al número de la paciente (link `wa.me`, sin API ni costo).
  - Paso 5 de `/reservar`: los tres botones ya comparten ancho y centrado
    (el bug de alineación que estaba anotado acá abajo, resuelto).

---

# Handoff anterior (12/7/2026 · sesión Fase 2)

Contexto para continuar en una sesión nueva. El sitio de **Cecilia Gutiérrez ·
Cosmetología Médica** (Astro 5 SSR en Vercel, dominio `cgcosmetologiamedica.com`)
está **en producción y funcionando**: reserva pública, cobro con MercadoPago,
agenda que crea eventos en Google Calendar, y panel de administración.

---

## 🎯 Prioridades para la PRÓXIMA sesión (empezar por acá)

**Antes de tocar nada: confirmá en qué rama estás y el estado del repo.**

1. **Pulido visual de `/reservar` (rápido y visible).**
   En una revisión quedaron botones/elementos mal centrados o que "se ven raros"
   pero funcionan. Foco:
   - Paso 4 (confirmar): "Pagar ahora con MercadoPago" / separador "o" /
     "Reservar y coordinar con Ceci" + sus hints.
   - Paso 5 (éxito): "Pagar mi reserva", "Avisar a Ceci por WhatsApp" y
     "Hacer otra reserva" quedan con anchos/centrado **inconsistentes**. Pista:
     `#pago-link` usa la clase `.pay` (full-width, centrado) y los otros dos no
     → unificar el tratamiento de esos botones.
   - Alinear/centrar y dejar ancho consistente. **No romper la funcionalidad (ya anda).**

2. **Seguridad — mergear el upgrade a Astro 7.**
   Rama `chore/upgrade-astro-seguridad` (cierra 4/5 vulnerabilidades), **SIN mergear**.
   ⚠️ El build local **NO corre en esta PC**: Windows App Control (Smart App Control)
   bloquea el compilador **nativo** de Astro 7 (`ERR_DLOPEN_FAILED`). Verificar en un
   **preview de Vercel** que buildea y que `/reservar` y `/admin` andan, y recién ahí
   mergear. Rebasar contra el `main` actual (ya tiene Fase 2; no chocan — deps vs código).
   Quedan 3 avisos de `path-to-regexp` (build-time, sin fix upstream, ya estaban en Astro 5).

3. **Backlog a explorar (features nuevas).**
   a) Al confirmar en admin, avisarle a la **paciente** por un canal directo tipo
      **WhatsApp** (hoy ya se manda **email** si dejó email, vía
      `notificarReservaConfirmada` en `reserva-confirmar.ts`).
   b) **Recordatorios automáticos** de turnos (ej. 24 h antes) → cron de Vercel +
      canal de envío. Evaluar WhatsApp Business API.
   Copy de cara al paciente: pasar por `skincare-brand-voice` + guardrails legales.

---

## ✅ Novedades de esta sesión (ya en PRODUCCIÓN, mergeadas a `main`)

- **Fase 1:** la "Agenda de próximas semanas" del admin ahora se navega **semana por
  semana** (flechas ‹ ›, arranca en la actual/próxima con datos). Mensaje opcional de
  WhatsApp en `/reservar` pasó a "me gustaría agendar… sujeto a confirmación". Calendario
  del cliente: se quitó el rojo de alarma de días llenos (paleta serena) + radios tokenizados.
- **Fase 2 — reserva SIN pago:** en `/reservar`, paso de confirmar con dos caminos:
  "Pagar ahora con MercadoPago" y "Reservar y coordinar con Ceci" (crea reserva
  `a_confirmar`, **retiene el cupo 2 h**, tope por sede Mvd 3 / SJ 4 / Online 3).
  Mensajes WhatsApp: "sujeto a confirmación" al coordinar; "PAGO CONFIRMADO vía
  MercadoPago" al volver del pago (detalle en `sessionStorage`).
- **Fase 2 — panel admin "Reservas a confirmar":** lista las `a_confirmar` con cuenta
  regresiva del hold; por reserva: monto + "ya pagó" + **Confirmar** / **Rechazar**.
  Confirmar deja el turno firme (= MercadoPago) + evento en Calendar. La tabla de
  Reservas tiene columna **Pago** con toggle cobrado/pendiente + monto (seguimiento).
- **Endpoints nuevos:** `/api/admin/por-confirmar`, `reserva-confirmar`, `reserva-rechazar`,
  `reserva-pago`. Migración **0005** (estado `a_confirmar`, columnas `monto_cobrado`/`pagado`,
  índice de cupo recreado) — se **auto-aplica** vía `ensureConfirmacion()` en la primera request.
- **Fix importante:** `.btn { display:inline-flex }` anulaba el atributo `hidden`
  (botón "Pagar mi reserva" quedaba visible en el camino coordinar). Se agregó
  `[hidden] { display:none !important }` en `global.css`.

## Ramas abiertas

- `chore/upgrade-astro-seguridad` — Astro 7 (ver prioridad 2). **Sin mergear.**
- `feat/reserva-sin-pago` — Fase 2. **Ya mergeada a main** (se puede borrar).

## Qué está funcionando (validado en producción)

- **Reserva pública** (`/reservar`): modalidad → sede → fecha/hora → datos → pagar/coordinar.
- **MercadoPago** (Checkout Pro, credenciales de **PRODUCCIÓN** reales). Webhook
  **fail-closed**: sin `MP_WEBHOOK_SECRET` los pagos aprobados NO confirman (está cargado).
- **Google Calendar**: al confirmar (pago o Ceci desde admin) se crea el evento en
  `cosmetologiamedicacg@gmail.com` (compartido con la service account).
- **Emails** (Resend): aviso de reserva, de "a confirmar" y de confirmación.
- **Panel admin** (`/admin`): disponibilidad + reservas + reservas a confirmar.

## Arquitectura de la agenda (modelo POR FECHA)

- Tabla **`franjas`** (`sede_id`, `fecha`, `hora`, `duracion_min`): cada fila = un turno
  disponible. `sede_id NULL` = Online.
- Tabla **`reservas`**: estados `pendiente_pago` (pago 30 min), `a_confirmar` (sin pago,
  hold 2 h), `confirmada`, `cancelada`, `expirada`. Reserva manual = `modalidad='manual'`.
- **`src/lib/agenda.ts`**: helpers (`ahoraUY`, `labelFecha`, `sedeKeyDeSlug`,
  `duracionDeTurno`). Hora Uruguay = `new Date(Date.now() - 3*3600*1000)`.
- **`src/lib/db.ts`**: funciones `ensure*` idempotentes que auto-aplican el esquema en
  runtime (no hay tool de migración; los `.sql` en `supabase/migrations` son referencia).

### ⚠️ Trampa de Astro ya resuelta (no reintroducir)
El calendario, la agenda, los turnos y las "reservas a confirmar" se crean por
**JavaScript** (`createElement`). Un `<style>` scoped de Astro **NO** aplica a elementos
creados dinámicamente → sus estilos van en el **`<style is:global>`** al final del archivo.

## Flujo de trabajo / cosas a saber

- **Deploy = push a `main`** (Vercel deploya solo, ~40-60s).
- **`gh` NO está instalado**: no se pueden abrir PRs por CLI. Se usa la API pública de
  GitHub, o se abre el PR a mano con el link `.../pull/new/<rama>` (el bot de Vercel
  comenta la URL del preview).
- **El preview de Vercel pide login de Vercel** (Vercel Authentication): se prueba
  logueado en el navegador, o directo en producción.
- La estética se ve recién con **Ctrl+Shift+R** (el CSS se cachea).
- **Windows App Control** bloquea el compilador nativo de Astro 7 → el build/dev local
  no corre en Astro 7 en esta PC (relevante para la prioridad 2).

## Variables de entorno (Vercel · Production) — todas cargadas

`DATABASE_URL` (Neon), `ADMIN_PASSWORD`, `MP_ACCESS_TOKEN` (APP_USR- producción),
`MP_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`,
`GOOGLE_CALENDAR_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `CECI_NOTIF_EMAIL`.

## Backlog técnico previo (sigue vigente)

1. **Agenda como grilla semanal**: hoy es lista vertical por día con chips (ya con
   navegación por semanas). Sebas la quiere más "tipo calendario semanal" (grilla de 7
   columnas). Refinamiento de `#agenda` en `admin.astro` + su CSS global.
2. **Limpiar endpoints de diagnóstico**: `src/pages/api/admin/diag-mp.ts` (entero) y el
   bloque extra en `test-calendar.ts` + `diagCalendario()` en `src/lib/calendar.ts`.
3. **Limpieza CSS admin**: reglas de elementos-JS duplicadas (scoped + is:global). Quitar
   las del scoped.
4. **Testimonios reales**: siguen placeholders (hard gate legal antes de traer tráfico).
5. **Assets**: `og-image.jpg` y `apple-touch-icon.png` pendientes.
