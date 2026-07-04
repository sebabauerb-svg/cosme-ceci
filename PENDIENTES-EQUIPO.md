# Pendientes de configuración — Cecilia Gutiérrez · Cosmetología Médica

> Guía paso a paso para el equipo. Estas tareas son de **configuración y contenido** (no de
> código): activan lo que ya está programado. Ordenadas por prioridad.
>
> **Dominio confirmado:** `cgcosmetologiamedica.com`

## Estado al día (actualizado)

| Ítem | Estado |
|---|---|
| 1.1 `ADMIN_PASSWORD` en Production | ✅ Hecho |
| 1.2 Rotar clave Google + borrar JSON | ✅ Hecho |
| 2.1 `MP_ACCESS_TOKEN` | ✅ Hecho |
| 2.2 `MP_WEBHOOK_SECRET` + URL webhook | ✅ Hecho — **falta validar de punta a punta** (ver 2.2) |
| 2.3 Resend `RESEND_API_KEY` | ✅ Hecho |
| 2.4 Resend dominio (DKIM + SPF) | ✅ Verificado para **envío** (el MX de recepción no hace falta) |
| 2.5 Resend `RESEND_FROM` / `CECI_NOTIF_EMAIL` | ✅ Hecho |
| 2.6 Prueba end-to-end de email | 🟡 **Falta: redeploy + reserva de prueba** (ver checklist en 2.3) |
| 3.1 Testimonios reales | 🟡 Pendiente — hoy hay placeholders mejorados (ver abajo) |
| 3.2 WhatsApp + email | ✅ Confirmados y cargados en el código |
| 3.3 Foto de Ceci | ✅ Ya está en la página |
| 4 Assets (og-image, apple-touch-icon) | ⬜ Pendiente |

**Pendientes activos que necesitan cierre:**
- **2.3 / 2.4 / 2.6 — Resend:** terminar la API key, verificar el dominio (los registros DNS deben
  figurar como *Verified* en Resend) y hacer una reserva de prueba para confirmar que el email
  llega. Detalle en la sección 2.3.
- **2.2 — Webhook MP:** hacer un pago de prueba y confirmar que el turno pasa a "confirmado" solo.
- **3.1 — Testimonios reales:** ver la sección 3.1 (incluye plantilla para pedirlos).
- **4 — Assets gráficos:** ver Bloque 4.

---

## ⚠️ Antes de empezar: cómo funcionan las variables en Vercel

Casi todo esto es "cargar variables de entorno" en Vercel. Regla de oro:

1. Entrá a **vercel.com** → login → elegí el proyecto del sitio.
2. **Settings** (menú superior) → **Environment Variables** (menú lateral).
3. Para cada variable: escribí el **Key** (nombre exacto, respetando mayúsculas), pegá el **Value**,
   marcá el entorno **Production** (y **Preview** si querés probar antes), y **Save**.
4. **IMPORTANTE:** las variables NO se aplican solas. Después de agregar/cambiar variables hay que
   **redeployar**: **Deployments** → último deployment → botón **⋯** → **Redeploy**.

Verificación general: si una variable quedó bien, la función que depende de ella empieza a andar
después del redeploy.

---

## 🔴 BLOQUE 1 — Crítico (sin esto el sitio no opera)

### 1.1 `ADMIN_PASSWORD` en Production
**Qué desbloquea:** que Ceci entre a `/admin` y cargue la disponibilidad de turnos. Sin esto, el
calendario aparece vacío para todas las clientas.

Pasos:
1. Elegí una contraseña fuerte (mínimo 12 caracteres, mezclá letras/números/símbolos).
2. Vercel → Settings → Environment Variables → Add.
3. Key: `ADMIN_PASSWORD` · Value: la contraseña · Environment: **Production**.
4. (Ya existe en Preview; el problema es que falta en Production.)
5. Redeploy.
6. Verificar: entrar a `https://cgcosmetologiamedica.com/admin`, ingresar la contraseña → debe
   abrir el panel.

### 1.2 Rotar la clave de Google y borrar el archivo filtrado
**Por qué:** el archivo `cecicosme-*.json` con la clave privada estuvo suelto en el proyecto. Hay
que anular esa clave y generar una nueva.

Pasos:
1. Entrá a **console.cloud.google.com** → seleccioná el proyecto de Ceci (arriba a la izquierda).
2. **IAM y administración** → **Cuentas de servicio**.
3. Abrí la cuenta de servicio (su email termina en `…iam.gserviceaccount.com`).
4. Pestaña **Claves** → **Agregar clave** → **Crear clave nueva** → tipo **JSON** → se descarga un
   archivo nuevo.
5. En la misma lista de claves, **borrá la clave vieja** (la que estaba en el `.json` filtrado).
6. Abrí el JSON nuevo y actualizá estas variables en Vercel (Production):
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` → el campo `client_email` del JSON
   - `GOOGLE_PRIVATE_KEY` → el campo `private_key` del JSON (copiá el valor completo, incluidos
     los `-----BEGIN PRIVATE KEY-----` … `-----END PRIVATE KEY-----`)
   - `GOOGLE_CALENDAR_ID` → **no cambia** (es el calendario de Ceci; dejalo como está)
7. Redeploy.
8. **Borrá el archivo JSON del disco** de quien lo tenga. Las credenciales viven solo en Vercel.
9. Verificar: entrar a `/admin`, usar el botón de prueba de calendario → debe crear un evento de
   prueba en el Google Calendar de Ceci.

> Nota sobre `GOOGLE_PRIVATE_KEY`: si Vercel te da problemas con los saltos de línea, pegá la clave
> tal cual viene en el JSON (con los `\n`). El código ya los interpreta.

---

## 🟠 BLOQUE 2 — Cobro y confirmación automática

### 2.1 `MP_ACCESS_TOKEN` (cobrar online)
**Qué desbloquea:** que el pago se cobre por la web con MercadoPago. Sin esto, el pago es un link
manual y Ceci confirma a mano.

Pasos:
1. Entrá a **mercadopago.com.uy** → **Tus integraciones** (Your integrations).
2. Elegí la aplicación del sitio (o creá una si no existe).
3. **Credenciales de producción** → copiá el **Access Token**.
   - ⚠️ Usá las de **producción**, no las de prueba (test).
4. Vercel → Environment Variables → Key: `MP_ACCESS_TOKEN` · Value: el token · Production.
5. Redeploy.

### 2.2 `MP_WEBHOOK_SECRET` + URL del webhook (confirmación automática y segura)
**Qué desbloquea:** que MercadoPago avise al sitio cuando un pago se aprueba, con firma verificada.

Pasos:
1. En la misma aplicación de MercadoPago → sección **Webhooks / Notificaciones**.
2. Configurá la **URL de producción**: `https://cgcosmetologiamedica.com/api/mp/webhook`
3. Marcá el evento **Pagos** (payments).
4. MercadoPago te muestra una **clave secreta / firma secreta** → copiala.
5. Vercel → Key: `MP_WEBHOOK_SECRET` · Value: esa clave · Production.
6. Redeploy.
7. Verificar: hacer una reserva de prueba y pagar → el turno debe pasar a "confirmado" solo.

### 2.3 Resend (email de confirmación automático)
**Qué desbloquea:** que la clienta y Ceci reciban un email cuando se reserva/confirma. Hoy la web
dice "te enviamos la confirmación por email" — si esto no está activo, ese mensaje no se cumple.

Pasos:
1. Creá una cuenta en **resend.com**.
2. **API Keys** → **Create API Key** → copiá la clave (empieza con `re_`).
3. **Domains** → **Add Domain** → agregá `cgcosmetologiamedica.com` → Resend te da unos registros
   **DNS** (SPF y DKIM) → cargalos en el panel del proveedor del dominio → esperá la verificación.
4. Vercel → agregá estas variables (Production):
   - `RESEND_API_KEY` → la clave `re_...`
   - `RESEND_FROM` → el remitente, ej: `Cecilia Gutiérrez <hola@cgcosmetologiamedica.com>`
     (usá una dirección del dominio verificado en el paso 3)
   - `CECI_NOTIF_EMAIL` → el email donde Ceci quiere recibir los avisos de reservas
5. Redeploy.
6. Verificar: hacer una reserva de prueba con un email tuyo → debe llegar el correo.

> Mientras el dominio no esté verificado, Resend solo deja enviar desde `onboarding@resend.dev` y
> a tu propio email. Para producción, verificá el dominio.

#### ⚠️ Aclaración importante sobre "Partially Verified" en Resend
Para **enviar** emails alcanza con **DKIM + SPF** verificados. Si ves esos dos en verde, el envío
ya funciona, aunque el dominio figure como **"Partially Verified"**.

- Lo que queda "Pending" suele ser **"Enable Receiving"** (un registro **MX** `inbound-smtp…
  amazonaws.com`). Eso es solo para **recibir** correos en `@cgcosmetologiamedica.com` vía Resend.
- **Este sitio no recibe emails, solo envía** → ese MX **NO hace falta**.
- Recomendación: **apagá el toggle "Enable Receiving"** en Resend (o ignorá ese pendiente). No
  agregues ese MX salvo que quieras recibir correo del dominio por Resend.

#### Cómo saber que el email quedó pronto (checklist)
1. `RESEND_API_KEY`, `RESEND_FROM`, `CECI_NOTIF_EMAIL` cargadas en Vercel → **redeploy** (las
   variables no se aplican sin redeploy).
2. Hacer una **reserva de prueba con un email propio** en el sitio.
3. Debe llegar el mail de confirmación (revisar spam la primera vez).
4. Al `CECI_NOTIF_EMAIL` debe llegar el aviso de "nueva reserva".
5. En Resend → pestaña **Emails** se ve cada envío con su estado (delivered/bounced).

---

## 🟡 BLOQUE 3 — Contenido que confirma Ceci

Esto es **material**, no configuración. Junten el contenido y pásenlo; la parte de cargarlo al
código la hace el desarrollador (indico el archivo para referencia).

### 3.1 Testimonios reales  ⚠️ hard gate antes de traer tráfico
Hoy hay 3 testimonios **de ejemplo (placeholder)** en el sitio. Se mejoró la redacción, pero
siguen siendo ficticios. **Publicar testimonios inventados como reales es publicidad engañosa**
(riesgo legal, no solo de credibilidad). Regla del proyecto: testimonios reales y con permiso.

**Qué hay que hacer:**
- Juntar 3 a 6 testimonios **reales**, cada uno con: texto, nombre (o nombre + inicial), ciudad, y
  **autorización explícita de la persona** para publicarlo.
- Foco: experiencia, trato y personalización. **Nunca** curas ni resultados garantizados
  ("me curó el acné", "resultados garantizados" → NO).
- Reemplazar los placeholders **antes** de cualquier campaña o envío masivo de tráfico.
- Archivo donde se cargan (lo hace el dev): `src/components/Testimonios.astro`.

**Plantilla para pedirlos por WhatsApp** (copiar/pegar y personalizar):
> Hola [nombre]! Estoy armando la web y me encantaría sumar tu experiencia. ¿Me escribirías en
> 2-3 líneas cómo fue tu atención conmigo (lo que más te sirvió, el trato, cómo quedó tu piel en
> general)? Si estás de acuerdo, lo publicaría con tu nombre de pila y tu ciudad. ¡Gracias!

> Mientras llegan los reales, el sitio muestra ejemplos marcados como placeholder en el código.

### 3.2 WhatsApp y email definitivos
Hoy están marcados `CONFIRMAR` en el código.
- **Confirmar:** número de WhatsApp exacto (formato internacional, ej: `598 9X XXX XXX`) y el email
  de contacto público.
- Archivo: `src/data/site.ts`.

### 3.3 Foto profesional de Ceci
Si la foto actual (`public/ceci.jpg`) es provisoria, pasar la definitiva.

---

## 🟢 BLOQUE 4 — Assets gráficos (para pulir SEO/redes)

Dejar los archivos en la carpeta `public/` del proyecto, con estos nombres exactos:

### 4.1 `og-image.jpg` — imagen al compartir el link
- Medidas: **1200 × 630 px**, formato **JPG**.
- Contenido sugerido: monograma "CG" + nombre + paleta de marca (crema/salvia), o una foto linda
  del espacio. Es lo que se ve cuando alguien comparte el sitio por WhatsApp/Instagram.
- Nombre exacto del archivo: `og-image.jpg` → dejar en `public/og-image.jpg`.
- (Hoy usa `hero.jpg` como provisorio; funciona pero se ve genérico.)

### 4.2 `apple-touch-icon.png` — ícono en iPhone
- Medidas: **180 × 180 px**, formato **PNG**, **fondo no transparente** (usá el color crema o salvia).
- Es el ícono cuando alguien guarda el sitio en la pantalla de inicio del iPhone.
- Nombre exacto: `apple-touch-icon.png` → dejar en `public/apple-touch-icon.png`.

### 4.3 Confirmar fotos del espacio
Confirmar que `public/hero.jpg`, `espacio-1.jpg`, `espacio-2.jpg`, `espacio-3.jpg` son las
definitivas. Si hay nuevas, pasarlas (idealmente livianas; si no, el dev las optimiza).

---

## Resumen de variables de entorno (todas en Vercel · Production)

| Variable | Bloque | De dónde sale |
|---|---|---|
| `ADMIN_PASSWORD` | 1.1 | la elige el equipo |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 1.2 | JSON nuevo de Google (`client_email`) |
| `GOOGLE_PRIVATE_KEY` | 1.2 | JSON nuevo de Google (`private_key`) |
| `GOOGLE_CALENDAR_ID` | 1.2 | ya está — no cambiar |
| `MP_ACCESS_TOKEN` | 2.1 | MercadoPago → Credenciales de producción |
| `MP_WEBHOOK_SECRET` | 2.2 | MercadoPago → Webhooks → clave secreta |
| `RESEND_API_KEY` | 2.3 | Resend → API Keys |
| `RESEND_FROM` | 2.3 | dirección del dominio verificado |
| `CECI_NOTIF_EMAIL` | 2.3 | email de Ceci para avisos |

> Opcional: `ADMIN_SESSION_SECRET` (si no se define, la sesión admin se firma derivando de
> `ADMIN_PASSWORD` y funciona igual).
