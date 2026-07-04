# Checklist QA — repaso previo al go-live

> Marcar cada ítem al probarlo. Probar TODO en la **URL de preview** de Vercel
> (Deployments → rama `feat/google-calendar` → Visit), nunca en producción.
> Producción no cambia hasta mergear a `main`.

---

## A. Cómo probar MercadoPago SIN pagar de verdad

El flujo cobra el valor real de la consulta. Para probar gratis se usa el **modo de prueba
(sandbox)** de MercadoPago **solo en Preview**:

1. En MercadoPago → **Tus integraciones → tu app → Credenciales de prueba** → copiá el
   **Access Token de prueba** (empieza con `TEST-`).
2. En Vercel → Environment Variables → editá `MP_ACCESS_TOKEN`: dejá el valor real solo en
   **Production**, y en **Preview** poné el token `TEST-…`.
   (Si hoy está como una sola variable "Production and Preview", editala y separá los valores
   por entorno — Vercel lo permite con "Add another value".)
3. `MP_WEBHOOK_SECRET`: la clave secreta del webhook es de la app de **producción**. Para que
   la confirmación automática funcione en sandbox, **quitá `MP_WEBHOOK_SECRET` del entorno
   Preview** (dejalo solo en Production). El código entonces procesa el webhook en preview sin
   exigir firma (avisa con un warning), y en producción sigue exigiéndola.
4. **Redeploy** del preview.
5. Pagá en el checkout con una **tarjeta de prueba** de MP (no mueve plata):
   - Mastercard `5031 7557 3453 0604` · CVV `123` · vencimiento `11/30`
   - Nombre del titular: `APRO` (fuerza pago aprobado) · Documento: cualquiera válido
   - Para probar rechazo: titular `OTHE`
6. Alternativa si no querés tocar variables: pago real + **reembolso total** desde el panel de
   MP (Actividad → el pago → Reembolsar). Devuelve el monto completo a la clienta.

## B. Flujo de reserva (sin llegar al pago)

- [ ] Home → tarjeta "Consulta Presencial" → lleva a `/reservar` con la modalidad ya elegida
- [ ] Idem "Consulta Virtual" y "Asesoramiento Skincare" (saltan directo al calendario)
- [ ] Presencial: pide sede (Montevideo / San José) antes del calendario
- [ ] El calendario muestra días reales (los que cargó Ceci en `/admin`) y excluye llenos
- [ ] Elegir día → aparecen horarios Mañana/Tarde → elegir → pide datos
- [ ] Club de las Estaciones: NO pide fecha (salta a datos) y el indicador no muestra "Fecha y hora"
- [ ] Datos inválidos (sin nombre / sin teléfono) → no deja continuar
- [ ] Resumen: servicio, sede, fecha/hora, nombre y total correctos
- [ ] Botón "Volver" funciona en cada paso sin perder lo elegido

## C. Pago y confirmación (con sandbox del bloque A)

- [ ] "Proceder al pago" → redirige a checkout de MercadoPago con el **monto correcto**
- [ ] Pagar con tarjeta de prueba APRO → vuelve a la web con "¡Turno confirmado!"
- [ ] La reserva queda **confirmada** (verla en `/admin`) sin intervención manual
- [ ] El horario elegido ya NO aparece disponible para otra persona
- [ ] Se creó el **evento en el Google Calendar** de Ceci (fecha/hora/duración correctas)
- [ ] Pago rechazado (titular OTHE) → mensaje "No se completó el pago", turno NO confirmado
- [ ] Abandonar el checkout → el cupo se libera solo pasados los 30 min
- [ ] Intentar reservar el mismo horario desde 2 navegadores → el segundo recibe "se ocupó recién"

## D. Emails (Resend)

- [ ] Al reservar: llega email a la clienta (si dejó email) y aviso a `CECI_NOTIF_EMAIL`
- [ ] Al confirmarse el pago: llega email de confirmación a ambas
- [ ] Revisar que no caigan a spam; remitente correcto (`RESEND_FROM`)
- [ ] En el dashboard de Resend (pestaña Emails) figuran como *delivered*

## E. Panel admin

- [ ] `/admin` pide contraseña; contraseña incorrecta → error; 5 intentos → bloqueo temporal
- [ ] Con sesión: se puede cargar/editar disponibilidad por sede
- [ ] La sesión expira sola a las 12 h (no hace falta probarlo, es informativo)

## F. Estética y responsive (desktop + celular real)

- [ ] Home: "Mi forma de trabajar" es un panel oscuro con pasos numerados a la derecha
- [ ] Filosofía: tres pilares en composición escalonada (bajan en diagonal), sin puntos de colores
- [ ] Testimonios: una cita grande destacada + dos menores (sin avatares de iniciales)
- [ ] Hero: foto limpia, sin píldoras flotantes
- [ ] Tipografía carga sin "salto" visible (fuentes locales)
- [ ] En celular: nada desborda horizontalmente; todo colapsa a una columna
- [ ] Errores de reserva aparecen como banner beige/arcilla (nunca alert del sistema)
- [ ] Página inexistente (ej. `/loquesea`) → 404 de marca con numeral grande

## G. SEO (ver código fuente de la página: Ctrl+U)

- [ ] `<link rel="canonical">` apunta a `cgcosmetologiamedica.com` (en preview mostrará el
      dominio de preview: verificarlo recién en producción)
- [ ] `og:image` presente; compartir el link por WhatsApp muestra imagen
- [ ] `/reservar` tiene `noindex`
- [ ] El artículo del blog tiene schema Article (buscar `"@type":"Article"` en el fuente)

## H. Puerta de salida a producción (hard gates)

- [ ] Todo lo anterior en verde en preview
- [ ] **Testimonios reales cargados** (los actuales son placeholder — NO lanzar campañas sin esto)
- [ ] `MP_ACCESS_TOKEN` de **producción** (no TEST) verificado en el entorno Production
- [ ] `MP_WEBHOOK_SECRET` presente en Production
- [ ] Merge del PR a `main` → deploy automático
- [ ] Post-deploy: repetir C.1–C.5 con **un pago real chico + reembolso** para validar producción
- [ ] Configurar en MP la URL de webhook de producción: `https://cgcosmetologiamedica.com/api/mp/webhook`
