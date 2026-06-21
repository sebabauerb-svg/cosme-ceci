# Backend de reservas — guía de armado (Fase 2b)

Estado: **esquema listo** (`migrations/0001_init.sql`). Falta provisionar la base y conectar
Mercado Pago + avisos. Esto documenta los pasos y lo que se necesita de afuera.

## 1. Provisionar la base de datos (elegir una)

El plan **free de Supabase llegó al límite** (2 proyectos activos: `mis-finanzas`,
`puestos-comercial`). Para hostear la base de reservas hace falta una de estas:

- **A — Upgrade a Supabase Pro** (~US$25/mes la org; ~US$35/mes con los 3 proyectos). Crear el
  proyecto `cosme-ceci` y aplicar la migración. Recomendado si se va a operar de verdad.
- **B — Liberar un slot**: pausar `puestos-comercial` (si no se usa) → crear `cosme-ceci` gratis.
- **C — Local para desarrollo**: `supabase start` (Docker) para probar local; no sirve para el
  preview de Vercel (no es accesible desde internet).

Una vez creado el proyecto, aplicar el esquema:
```bash
# opción CLI
supabase link --project-ref <ref> && supabase db push
# u opción MCP: apply_migration con el contenido de migrations/0001_init.sql
```

## 2. Variables de entorno (Vercel + local `.env`)

```
PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
PUBLIC_SUPABASE_ANON_KEY=<anon key>        # lectura pública de agenda
SUPABASE_SERVICE_ROLE_KEY=<service role>   # solo backend, NUNCA en el cliente

MP_ACCESS_TOKEN=<Mercado Pago access token>   # TEST primero (TEST-...)
MP_WEBHOOK_SECRET=<secreto del webhook>
PUBLIC_SITE_URL=https://cgcosmetologiamedica.com

# Avisos (elegir canal — ver sección 4)
RESEND_API_KEY=<si se usa email>
CECI_NOTIF_EMAIL=<mail donde Ceci recibe las reservas>
```

## 3. Mercado Pago (lo que hay que conseguir)

- **Cuenta de empresa/vendedor de Ceci** verificada (a su nombre/RUT).
- En el panel de desarrolladores de MP: crear una aplicación → obtener credenciales
  **TEST** (para sandbox) y luego **producción**.
- Flujo técnico: el endpoint `/api/reservar` crea una *preference* (Checkout Pro) y devuelve el
  `init_point`; la clienta paga; MP llama al **webhook** `/api/mp-webhook` → se valida el pago y
  la reserva pasa a `confirmada`. Un job libera las `pendiente_pago` vencidas (`expira_at`).
- Comisión real ~3,99% + IVA (~4,87%). En TEST no se cobra nada (tarjetas de prueba).

## 4. Avisos (elegir)

- **Recomendado para arrancar:** email a la clienta + email a Ceci (vía Resend u otro), y/o
  **evento en Google Calendar** de Ceci (lo ve en la agenda del celular).
- **WhatsApp automático:** fase posterior (WhatsApp Business API = costo por mensaje + trámite).

## 5. Cambios de código que faltan (cuando haya DB + credenciales)

1. Adapter de servidor: `@astrojs/vercel` + endpoints con `export const prerender = false`.
2. `src/lib/supabase.ts` (cliente anon para leer agenda; service role solo en endpoints).
3. Endpoints: `POST /api/reservar` (crea reserva + preference MP) y `POST /api/mp-webhook`
   (confirma pago). Job de expiración (cron de Vercel).
4. Conectar `/reservar`: leer disponibilidad real por sede, y en el paso de pago llamar a
   `/api/reservar` en vez del mock.
5. Panel mínimo para Ceci (ver reservas; configurar disponibilidad por sede) — o usar el panel
   de Supabase al principio.

## Resumen de lo pendiente de Sebas/Ceci
- [ ] Decidir provisión de DB (A / B / C arriba).
- [ ] Cuenta de empresa Mercado Pago + credenciales TEST.
- [ ] Canal de avisos (email / Google Calendar / WhatsApp).
