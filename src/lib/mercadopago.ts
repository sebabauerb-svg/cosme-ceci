/**
 * Integración con MercadoPago (Checkout Pro).
 * Usa MP_ACCESS_TOKEN (de Vercel). Si falta, las funciones lanzan y el llamador
 * cae al flujo manual (no rompe la reserva).
 *
 * - crearPreferencia: genera el checkout con el monto exacto del servicio.
 * - obtenerPago: consulta el estado real de un pago (fuente de verdad del webhook).
 */

import crypto from 'node:crypto';

const MP_API = 'https://api.mercadopago.com';

function accessToken(): string {
  const t = process.env.MP_ACCESS_TOKEN;
  if (!t) throw new Error('Falta MP_ACCESS_TOKEN');
  return t;
}

/** ¿Está configurado MercadoPago? (para decidir si cobramos online o caemos al flujo manual) */
export function mpConfigurado(): boolean {
  return !!process.env.MP_ACCESS_TOKEN;
}

/** ¿Hay secret para verificar la firma del webhook? */
export function webhookSecretConfigurado(): boolean {
  return !!process.env.MP_WEBHOOK_SECRET;
}

/**
 * Verifica la firma HMAC del webhook de MercadoPago.
 * Manifest: `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`
 * firmado con HMAC-SHA256 usando MP_WEBHOOK_SECRET; se compara contra v1.
 * Docs: https://www.mercadopago.com.uy/developers/es/docs/your-integrations/notifications/webhooks
 *
 * Si el secret no está configurado: en producción devuelve false (fail-closed —
 * el secret es requisito de go-live); en desarrollo devuelve true para poder probar.
 */
export function verificarFirmaWebhook(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
}): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET;
  if (!secret) return !import.meta.env.PROD;
  if (!opts.xSignature) return false;

  let ts: string | null = null;
  let v1: string | null = null;
  for (const parte of opts.xSignature.split(',')) {
    const idx = parte.indexOf('=');
    if (idx < 0) continue;
    const k = parte.slice(0, idx).trim();
    const v = parte.slice(idx + 1).trim();
    if (k === 'ts') ts = v;
    else if (k === 'v1') v1 = v;
  }
  if (!ts || !v1) return false;

  const id = (opts.dataId ?? '').toLowerCase(); // MP normaliza el data.id a minúsculas
  const manifest = `id:${id};request-id:${opts.xRequestId ?? ''};ts:${ts};`;
  const esperada = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  const a = Buffer.from(v1);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function crearPreferencia(opts: {
  titulo: string;
  precio: number;
  reservaId: string;
  origin: string;
  email?: string | null;
  /** ISO de cuándo vence la reserva pendiente: el checkout se cierra a la vez */
  expiraIso?: string | null;
}): Promise<{ id: string; initPoint: string }> {
  const body = {
    items: [
      {
        title: opts.titulo.slice(0, 250),
        quantity: 1,
        unit_price: opts.precio,
        currency_id: 'UYU',
      },
    ],
    external_reference: opts.reservaId,
    ...(opts.email ? { payer: { email: opts.email } } : {}),
    back_urls: {
      success: `${opts.origin}/reservar?pago=ok&rid=${opts.reservaId}`,
      pending: `${opts.origin}/reservar?pago=pendiente&rid=${opts.reservaId}`,
      failure: `${opts.origin}/reservar?pago=error&rid=${opts.reservaId}`,
    },
    auto_return: 'approved',
    notification_url: `${opts.origin}/api/mp/webhook`,
    metadata: { reserva_id: opts.reservaId },
    // El link de pago vence junto con la reserva (30 min): pagar más tarde
    // dejaría plata acreditada sin cupo garantizado.
    ...(opts.expiraIso
      ? { expires: true, expiration_date_to: opts.expiraIso.replace('Z', '-00:00') }
      : {}),
  };

  const res = await fetch(`${MP_API}/checkout/preferences`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken()}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`MP preferencia ${res.status}: ${await res.text()}`);
  }
  const d: any = await res.json();
  const initPoint = d.init_point || d.sandbox_init_point;
  if (!initPoint) throw new Error('MP no devolvió init_point');
  return { id: String(d.id), initPoint };
}

/** Consulta un pago por id. Devuelve null si no se pudo. */
export async function obtenerPago(paymentId: string): Promise<any | null> {
  const res = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${accessToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}
