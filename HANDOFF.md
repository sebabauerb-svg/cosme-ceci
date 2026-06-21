# Handoff — Cecilia Gutiérrez · Cosmetología Médica

> Documento para retomar el proyecto sin perder contexto. Estado, decisiones y plan.
> Última actualización: 2026-06-21 (Fase 2b: reservas reales).

## 1. Qué es
Sitio de **Cecilia Gutiérrez · Cosmetología Médica** (Montevideo y San José, Uruguay). Astro
estático + endpoints serverless. Deploy en Vercel.

- **Producción (en vivo):** https://cgcosmetologiamedica.com — rama `main`.
  Hoy es el sitio institucional con los CTA "Agendar" → **WhatsApp** (todavía NO el flujo de reservas).
- **Repo:** github.com/sebabauerb-svg/cosme-ceci (privado).
- **Deploy:** automático (push a `main` → producción; push a `feat/reservas` → preview).
- Datos editables sin código: `src/data/{site,modalidades,tratamientos,club,imagenes}.ts`.
- Brief de marca: `PROMPT.md`. Skills: `.claude/skills/skincare-*`.

## 2. El sistema de reservas (rama `feat/reservas`, NO mergeado aún)
Funciona de punta a punta en el **preview** (URL estable, protegida por login de Vercel):
`https://cosme-ceci-git-feat-reservas-sebabauerb-svgs-projects.vercel.app`

**Flujo `/reservar`** (4 pasos): modalidad → (sede si es presencial) → **calendario mensual** de
fechas reales → datos → "Confirmar por WhatsApp". Al confirmar: crea la reserva en la base
(estado `pendiente_pago`), **bloquea el cupo** (índice único, sin doble reserva), abre WhatsApp a
Ceci con el detalle y muestra el **link de pago de Mercado Pago**.

**Panel `/admin`**: login con contraseña → Ceci marca **fechas concretas** por sede en un
calendario + los **horarios** (intervalos: San José/Online 30 min, Montevideo 45 min, hasta 20:30)
→ Guardar. También ve la lista de reservas. La disponibilidad pública sale de lo que ella marca.

## 3. Infraestructura (todo gratis)
- **Base de datos: Neon (Postgres)**, proyecto `cosme-ceci` creado vía integración de Vercel
  (Supabase estaba lleno con `mis-finanzas` + `puestos-comercial`). Base `neondb`, host
  `ep-icy-leaf-...us-east-1`. La conexión la inyecta Vercel como `DATABASE_URL`.
  - Tablas: `sedes` (Montevideo, San José), `franjas` (sede_id, fecha, hora — disponibilidad por
    FECHA, es la activa), `reservas`, `bloqueos`. (`disponibilidad` semanal quedó sin uso.)
  - El esquema se aplicó con un endpoint one-shot que usaba la misma conexión de la app
    (para evitar el desfase de ramas de Neon). `ensureFranjas()` crea `franjas` si falta.
- **Adapter:** `@astrojs/vercel@8` (Astro 5). Páginas siguen estáticas; solo `/api/*` y `/admin`
  corren en serverless (`export const prerender = false`).
- **Pago:** link de Mercado Pago de Ceci: `https://link.mercadopago.com.uy/cecigutierrezcm`
  (en `site.enlaces.pagoMercadoPago`). Confirmación **manual** (Ceci ve el pago + WhatsApp + el
  panel). La API de MP con webhook (confirma solo) es mejora futura.

### Archivos clave de la Fase 2b
- `src/lib/db.ts` — `getSql()` (Neon por env) + `ensureFranjas()`.
- `src/lib/admin.ts` — auth admin (cookie httpOnly derivada de `ADMIN_PASSWORD`).
- `src/pages/api/disponibilidad.ts` — GET fechas/horas reales por sede (excluye tomadas/bloqueos).
- `src/pages/api/reservar.ts` — POST crea reserva + bloquea cupo (409 si el cupo se tomó).
- `src/pages/api/admin/login.ts` — POST/DELETE login.
- `src/pages/api/admin/disponibilidad.ts` — POST guarda franjas (fechas × horas) por sede.
- `src/pages/admin.astro` — panel (login + calendario por sede + horarios + reservas).
- `src/pages/reservar.astro` — flujo de reserva (calendario mensual + bloqueo + MP + WhatsApp).
- `supabase/migrations/0001_init.sql` — esquema base (referencia).

### Variables de entorno (Vercel)
- `DATABASE_URL` (Neon) — la pone la integración (verificar que esté en **Production** también).
- `ADMIN_PASSWORD` — la creó Sebas (está en Preview; **falta marcarla en Production** para el go-live).

## 4. Decisiones tomadas (no re-litigar)
- Marca paraguas Cecilia Gutiérrez · Cosmetología Médica; "Skincare Inteligente" es una modalidad.
- Voz del dossier (Cosmetología Médica, diagnóstico, evaluación clínica). No prometer curas.
- Precios: Presencial $1.800 · Virtual $1.500 · Skincare Inteligente $1.600 · Club $4.800/año.
- Reservas: pago **100% al reservar** vía link MP; todas las modalidades; presencial pide sede;
  disponibilidad **por fechas concretas** (no por día de semana, porque Ceci va a San José en
  fechas puntuales). Intervalos por sede (30/45 min). Horarios hasta 20:30.
- Fuentes Fraunces+Inter (pendiente opcional: cambiarlas por Spectral+Hanken).

## 5. Pendiente / próximos pasos
- [ ] **Go-live a producción:** confirmar `ADMIN_PASSWORD` y `DATABASE_URL` en **Production** →
      quitar banner "versión de prueba" → merge `feat/reservas` → `main`. Limpiar reservas de prueba.
- [ ] **Acceso admin de Ceci:** en el **preview** no entra (Vercel exige login de Vercel). En
      **producción** entra **solo con la contraseña** (sin cuenta Vercel). → otra razón para ir a prod.
- [ ] **Visual (pedido):** mostrar los **horarios** como calendario/grilla más amigable ("tipo calendario").
- [ ] **Email automático** de confirmación (clienta + Ceci) vía Resend (gratis).
- [ ] **Auto-expirar** reservas no pagadas (cron de Vercel; hoy el cupo queda tomado hasta gestión manual).
- [ ] **MP API + webhook** para que el pago confirme solo (hoy es manual).
- [ ] Visual: fuentes Spectral+Hanken (opcional).

## 6. Cómo trabajar
- Sandbox = rama `feat/reservas` + preview de Vercel (no toca producción). Verificar con `npm run build`.
- El preview está protegido por login de Vercel (privado). Producción es público.
- Estado de la rama al cerrar: ver último commit en `feat/reservas`.
