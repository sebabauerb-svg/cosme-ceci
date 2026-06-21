# Handoff — Cecilia Gutiérrez · Cosmetología Médica

> Documento para retomar el proyecto en una sesión nueva. Resume el estado, las
> decisiones tomadas y el plan para seguir. Complementa `PROMPT.md` (brief de marca)
> y la memoria del proyecto.
> Última actualización: 2026-06-21.

## 1. Qué es

Sitio web de **Cecilia Gutiérrez · Cosmetología Médica** — práctica boutique de cuidado
de la piel en Montevideo y San José (Uruguay). Astro estático, deploy en Vercel.

- **Producción (en vivo, estable):** https://cgcosmetologiamedica.com
- **Repo:** https://github.com/sebabauerb-svg/cosme-ceci (privado) — rama `main`.
- **Deploy:** automático (GitHub → Vercel) en cada push a `main`.
- Datos editables sin código: `src/data/{site,modalidades,tratamientos,club,imagenes}.ts`.
- Brief completo: `PROMPT.md`. Skills del proyecto: `.claude/skills/skincare-*`.

## 2. Estado actual

### Producción (rama `main`) — terminado y publicado
Home (hero con foto, filosofía, 4 modalidades, tratamientos, Club, sobre Ceci, galería,
testimonios, reserva, FAQ), `/aviso-legal`, `/blog` (scaffold). Diseño pulido con criterio
(paleta salvia/arcilla/crema, Fraunces+Inter). Los CTA de producción van a **WhatsApp**.

### Sandbox (rama `feat/reservas`) — prototipo en revisión, NO mergeado
- **Preview (protegido por login de Vercel):**
  https://cosme-ceci-git-feat-reservas-sebabauerb-svgs-projects.vercel.app/reservar
- Página nueva **`/reservar`**: flujo visual de reserva en 4 pasos
  (modalidad → fecha/hora → datos → pago). **Es demo: sin backend, sin pagos, no guarda ni avisa.**
- En esta rama, los botones "Agendar/Reservar" (nav, hero, sección reserva) llevan a `/reservar`
  (en `main` siguen yendo a WhatsApp).
- **Selector de sede (Montevideo / San José)**: aparece solo en *Consulta Presencial*; la agenda
  se revela al elegir sede; la sede figura en resumen y confirmación.
- Archivo principal: `src/pages/reservar.astro` (todo autocontenido: markup + script + estilos).

## 3. Decisiones tomadas (no re-litigar)

- **Marca paraguas:** Cecilia Gutiérrez · Cosmetología Médica. "Skincare Inteligente" es UNA modalidad.
- **Voz del dossier tal cual:** se usa "Cosmetología Médica", "diagnóstico", "evaluación clínica".
  No suavizar. Solo no prometer curas ni resultados garantizados (ver `skincare-legal-guardrails`).
- **Precios:** Consulta Presencial $1.800 · Consulta Virtual $1.500 · Asesoramiento Skincare
  Inteligente $1.600 · Club $4.800/año (4 cuotas de $1.200). Tratamientos sin precio en web
  ("según protocolo"). Definidos por Sebas/Ceci.
- **Reservas (prototipo):** pago **100% al reservar**; **todas las modalidades** reservables;
  presencial pide **sede**.
- **Contacto:** WhatsApp `59898192050` (098 19 20 50, confirmado), IG @cgcosmetologiamedica.
  **El mail no se usa** (no va en la web).
- **Paleta y tipografía fijas.** Pendiente (opcional): cambiar Fraunces+Inter por una dupla más
  distintiva (propuesta: Spectral + Hanken Grotesk) — Sebas no la aprobó aún.

## 4. Próximo paso: hacer la reserva REAL (Fase 2b)

Objetivo: que `/reservar` guarde la reserva y avise, con pago real. Plan recomendado, todo en
sandbox primero (rama `feat/reservas`, preview), validar, y recién después merge a `main`.

### Arquitectura
- **Backend:** Supabase (proyecto de **desarrollo** aparte; en prod, misma organización que
  Mis Finanzas → +~US$10/mes, total ~US$35/mes con Pro). Tablas: sedes, disponibilidad
  (días/horarios por sede), turnos (estado: pendiente/confirmado/cancelado), reservas.
- **Pagos:** **Mercado Pago** en **modo test** primero (tarjetas de prueba). Comisión real
  ~3,99% + IVA (~4,87%). Requiere **cuenta de empresa MP de Ceci** + credenciales.
  Ningún calendario llave-en-mano (Calendly/Cal.com) cobra con MP, y Stripe no opera en UY →
  la integración MP es a medida (Checkout Pro / preferencia + webhook).
- **Funciones serverless** en Vercel: crear preferencia de pago, **webhook de confirmación**
  (idempotente, validar firma), y expiración de reservas no pagadas.
- **Notificaciones (recomendado para arrancar):** email a la clienta + email o **evento en
  Google Calendar** para Ceci. WhatsApp automático = fase posterior (WhatsApp Business API
  tiene costo y trámite).

### Funcionalidad para Ceci (admin) — pedida explícitamente
- Configurar **qué días y horarios atiende en cada sede** (Montevideo / San José).
- Ver y gestionar las reservas (panel simple).

### Riesgos a cubrir
Doble reserva (bloqueo de slot/concurrencia), zona horaria UY, expiración de no pagadas,
política de cancelación/reembolso (MP no devuelve comisión), datos personales.

## 5. Progreso Fase 2b y pendientes

**Hecho (2026-06-21):** esquema de base de datos completo en `supabase/migrations/0001_init.sql`
(sedes, disponibilidad por sede, bloqueos, reservas; RLS cerrado; índice anti-doble-reserva;
seed de Montevideo y San José). Guía de armado en `supabase/README.md`.

**Bloqueo encontrado:** el plan **free de Supabase está lleno** (2 proyectos activos:
`mis-finanzas`, `puestos-comercial`). Para hostear la base hay que: (A) upgrade a Pro
(~US$25/mes, ~US$35 total), (B) pausar `puestos-comercial`, o (C) Supabase local para dev.
Org id: `bhldlhughrnjyzyfunhe`.

**Pendiente de Sebas/Ceci para continuar:**
- [ ] Elegir provisión de DB (A / B / C) → ahí aplico la migración y sigo con los endpoints.
- [ ] Cuenta de empresa en Mercado Pago + credenciales TEST.
- [ ] Definir canal de aviso (email / Google Calendar / WhatsApp).
- [ ] Confirmar si el Club entra al flujo de pago o se vende aparte.
- [ ] Decisión sobre fuentes (mantener o cambiar a Spectral+Hanken).

## 6. Cómo trabajar
- Empezar con la skill `skincare-orchestrator`. Para deploy, `skincare-deploy-vercel`.
- Sandbox = rama + preview de Vercel (no toca producción). Verificar con `npm run build`.
  El render del panel de preview puede fallar en algunos entornos; confiar en build + curl.
- El preview de Vercel está protegido por login (solo Sebas lo ve) — ideal para sandbox.
- Estado de la rama al cerrar: `feat/reservas` @ commit `96c23fc`.
