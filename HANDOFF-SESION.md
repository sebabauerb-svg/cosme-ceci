# Handoff — estado del proyecto (12/7/2026)

Contexto para continuar en una sesión nueva. El sitio de **Cecilia Gutiérrez ·
Cosmetología Médica** (Astro 5 SSR en Vercel, dominio `cgcosmetologiamedica.com`)
está **en producción y funcionando**: reserva pública, cobro con MercadoPago,
agenda que crea eventos en Google Calendar, y panel de administración.

## Qué está funcionando (validado en producción)

- **Reserva pública** (`/reservar`): elegir modalidad → sede → fecha/hora → datos → pago.
- **MercadoPago** (Checkout Pro, credenciales de **PRODUCCIÓN** reales de la cuenta de
  Ceci). Validado end-to-end con un pago real de $1: la reserva se confirma sola.
  - ⚠️ El webhook es **fail-closed en producción**: sin `MP_WEBHOOK_SECRET` los pagos
    aprobados NO confirman la reserva. Está cargado y funcionando.
- **Google Calendar**: al confirmarse un pago se crea el evento en el calendario
  `cosmetologiamedicacg@gmail.com`. Requirió compartir ese calendario con la cuenta de
  servicio `reservascecicosme@cecicosme.iam.gserviceaccount.com` (permiso "Hacer cambios
  en los eventos"). Ya hecho.
- **Emails** (Resend): aviso de reserva y de confirmación.
- **Panel admin** (`/admin`): gestión de disponibilidad + reservas.

## Arquitectura de la agenda (modelo POR FECHA)

Tras dos rediseños (ver historia abajo), el modelo final es **por fecha**:

- Tabla **`franjas`** (`sede_id`, `fecha`, `hora`, `duracion_min`): cada fila = un turno
  disponible. `sede_id NULL` = Online.
- Reservas en tabla **`reservas`**. Reserva manual = `modalidad='manual'`, `telefono='—'`,
  `estado='confirmada'` (ocupa el cupo).
- **`src/lib/agenda.ts`**: helpers (`ahoraUY`, `labelFecha`, `sedeKeyDeSlug`,
  `duracionDeTurno`). Zona horaria Uruguay = `new Date(Date.now() - 3*3600*1000)`.
- **Endpoints admin**: `/api/admin/horario` (GET/POST franjas por sede),
  `/api/admin/reserva-manual` (POST/DELETE), `/api/admin/resumen` (agenda consolidada),
  `/api/admin/reserva` (DELETE, borra reserva + evento Calendar).
- **Público**: `/api/disponibilidad` (lee franjas), `/api/reservar` (valida contra franjas),
  `/api/mp/webhook`, `/api/reserva-estado`.
- Tablas sin uso que quedaron en la DB: `horario_semanal` (rediseño descartado). No molesta.

## Panel admin — cómo funciona (`src/pages/admin.astro`)

- Pestañas de sede (Montevideo/San José/Online), una a la vez.
- Selector de franja (desde/hasta/duración, **formato 24h con selects**).
- Calendario mensual navegable: tocar días para abrirlos; atajo "Repetir cada `<día>` por
  N semanas" (toggle: segundo click deshace).
- Panel del día: abrir/cerrar día, marcar turno como reservado (solo nombre), liberar.
- "Agenda de las próximas semanas": vista consolidada por día, colores por sede
  (Montevideo=salvia, Online=azul `#6d8299`, San José=arcilla).

### ⚠️ Trampa de Astro ya resuelta (no reintroducir)
El calendario, la agenda y los turnos se crean por **JavaScript** (`createElement`). Un
`<style>` scoped de Astro **NO** aplica a elementos creados dinámicamente. Por eso sus
estilos van en un **`<style is:global>`** al final del archivo. Si agregás estilos para
elementos que crea el JS, ponelos en ese bloque global, no en el scoped.

## Pendientes / próximos pasos

1. **Agenda como grilla semanal**: hoy es una lista vertical por día con chips coloreados.
   Sebas la quiere más "tipo calendario semanal" (grilla de 7 columnas con las horas). Es
   un refinamiento de UI de la sección `#agenda` en `admin.astro` + su CSS global.
2. **Limpiar endpoints de diagnóstico temporales** (se crearon para depurar y ya no hacen
   falta): `src/pages/api/admin/diag-mp.ts` (entero) y el bloque de diagnóstico extra en
   `src/pages/api/admin/test-calendar.ts` + `diagCalendario()` en `src/lib/calendar.ts`.
3. **Limpieza CSS**: en `admin.astro` las reglas de elementos-JS quedaron duplicadas (una
   vez en el `<style>` scoped, otra en el `<style is:global>`). Quitar las del scoped.
4. **Testimonios reales**: siguen siendo placeholders (hard gate legal antes de traer
   tráfico). Ver `PENDIENTES-EQUIPO.md`.
5. **Assets**: `og-image.jpg` y `apple-touch-icon.png` pendientes (Bloque 4 de PENDIENTES).

## Variables de entorno (Vercel · Production)

Todas cargadas y funcionando: `DATABASE_URL` (Neon), `ADMIN_PASSWORD`, `MP_ACCESS_TOKEN`
(APP_USR- producción), `MP_WEBHOOK_SECRET`, `PUBLIC_SITE_URL`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`,
`GOOGLE_PRIVATE_KEY`, `GOOGLE_CALENDAR_ID`, `RESEND_API_KEY`, `RESEND_FROM`, `CECI_NOTIF_EMAIL`.

## Flujo de trabajo

- Deploy = push a `main` (Vercel deploya solo, ~40-60s). `gh` no está instalado; se usa la
  API pública de GitHub para chequear el estado del deploy.
- El preview de Vercel está protegido por Vercel Authentication (no accesible sin login),
  así que se prueba directo en producción.
- La estética se ve recién con **Ctrl+Shift+R** (el CSS se cachea).

## Historia de los rediseños del admin (para no repetir)

1. Franjas por fecha con checkboxes hora-por-hora → confuso.
2. Horario semanal recurrente → no servía (San José es por fechas puntuales).
3. **Por fecha con calendario navegable + reserva manual** (actual y aprobado).
