/**
 * Integración con MercadoPago (Checkout Pro).
 * Usa MP_ACCESS_TOKEN (de Vercel). Si falta, las funciones lanzan y el llamador
 * cae al flujo manual (no rompe la reserva).
 *
 * - crearPreferencia: genera el checkout con el monto exacto del servicio.
 * - obtenerPago: consulta el estado real de un pago (fuente de verdad del webhook).
 */

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

export async function crearPreferencia(opts: {
  titulo: string;
  precio: number;
  reservaId: string;
  origin: string;
  email?: string | null;
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
      success: `${opts.origin}/reservar?pago=ok`,
      pending: `${opts.origin}/reservar?pago=pendiente`,
      failure: `${opts.origin}/reservar?pago=error`,
    },
    auto_return: 'approved',
    notification_url: `${opts.origin}/api/mp/webhook`,
    metadata: { reserva_id: opts.reservaId },
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
