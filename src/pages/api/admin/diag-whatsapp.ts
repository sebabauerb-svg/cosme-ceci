import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin';
import { enviarWhatsApp, whatsappConfigurado, telefonoE164, NOMBRES_PLANTILLA } from '../../../lib/whatsapp';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * GET /api/admin/diag-whatsapp → cómo está configurado el WhatsApp automático
 * (sin exponer la clave: solo si está y su largo).
 */
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const key = process.env.WHATSAPP_API_KEY || '';
  return json({
    ok: true,
    activo: whatsappConfigurado(),
    proveedor: process.env.WHATSAPP_PROVIDER === 'meta' ? 'meta' : 'ycloud',
    api_key_presente: !!key,
    api_key_largo: key.length,
    from: process.env.WHATSAPP_FROM || '(default de site.ts)',
    idioma: process.env.WHATSAPP_TEMPLATE_LANG || 'es',
    plantillas: NOMBRES_PLANTILLA,
  });
};

/**
 * POST /api/admin/diag-whatsapp  { telefono, plantilla? }
 * Manda una plantilla de prueba con datos ficticios a ESE número (el de quien
 * prueba, no el de una paciente). Devuelve el error real del proveedor si falla:
 * es la forma de saber si las plantillas quedaron bien cargadas.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Cuerpo inválido' }, 400); }
  if (!telefonoE164(body?.telefono)) return json({ ok: false, error: 'Teléfono inválido' }, 400);
  const plantilla = ['confirmado', 'movido', 'recordatorio'].includes(body?.plantilla) ? body.plantilla : 'confirmado';
  const r = await enviarWhatsApp(plantilla, body.telefono, {
    nombre: 'Prueba',
    servicio: 'Consulta Presencial',
    fechaLarga: 'jueves 8 de octubre',
    hora: '10:30',
    sede: 'Montevideo',
    token: '0'.repeat(32),
    cobro: 'Seña recibida: $700. Saldo a abonar en la consulta: $1.100.',
  });
  return json({ ok: r.ok, plantilla, error: r.error ?? null }, r.ok ? 200 : 502);
};
