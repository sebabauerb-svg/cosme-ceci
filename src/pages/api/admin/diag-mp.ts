import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

// GET /api/admin/diag-mp  → diagnóstico de la configuración de MercadoPago.
// Protegido por sesión admin. NO expone los secretos: solo si están presentes,
// su prefijo, y el error real que devuelve la API de MP al crear una preferencia.
// Temporal: sirve para depurar el go-live; se puede borrar después.
export const GET: APIRoute = async ({ cookies, request }) => {
  if (!isAdmin(cookies)) {
    return new Response(JSON.stringify({ ok: false, error: 'No autorizado' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const token = process.env.MP_ACCESS_TOKEN || '';
  const prefijo = token.startsWith('TEST-')
    ? 'TEST'
    : token.startsWith('APP_USR-')
      ? 'PRODUCCION'
      : token
        ? 'DESCONOCIDO'
        : 'AUSENTE';

  const diag: Record<string, unknown> = {
    mp_access_token_presente: !!token,
    mp_access_token_prefijo: prefijo,
    mp_access_token_largo: token.length,
    mp_webhook_secret_presente: !!process.env.MP_WEBHOOK_SECRET,
    public_site_url: process.env.PUBLIC_SITE_URL || process.env.SITE_URL || '(sin definir — usa el origin del request)',
    origin_del_request: new URL(request.url).origin,
  };

  // Test real: crear una preferencia mínima y ver qué responde MP.
  if (token) {
    const origin = process.env.PUBLIC_SITE_URL || process.env.SITE_URL || new URL(request.url).origin;
    const body = {
      items: [{ title: 'Prueba diagnóstico', quantity: 1, unit_price: 100, currency_id: 'UYU' }],
      back_urls: {
        success: `${origin}/reservar?pago=ok`,
        pending: `${origin}/reservar?pago=pendiente`,
        failure: `${origin}/reservar?pago=error`,
      },
      auto_return: 'approved',
      notification_url: `${origin}/api/mp/webhook`,
    };
    try {
      const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const texto = await res.text();
      diag.mp_test_status = res.status;
      if (res.ok) {
        let initPoint = null;
        try {
          const d = JSON.parse(texto);
          initPoint = d.init_point || d.sandbox_init_point || null;
        } catch {
          /* ignore */
        }
        diag.mp_test_resultado = initPoint ? 'OK — MP devolvió link de pago' : 'MP respondió 200 pero sin init_point';
      } else {
        // El cuerpo del error de MP dice exactamente qué está mal.
        diag.mp_test_resultado = 'ERROR de MercadoPago';
        diag.mp_test_error = texto.slice(0, 800);
      }
    } catch (e) {
      diag.mp_test_resultado = 'No se pudo contactar la API de MercadoPago';
      diag.mp_test_error = e instanceof Error ? e.message : String(e);
    }
  }

  return new Response(JSON.stringify({ ok: true, diag }, null, 2), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
};
