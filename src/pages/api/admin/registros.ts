import type { APIRoute } from 'astro';
import { getSql, ensurePerfil } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { baseUrl } from '../../../lib/pacientes';
import { INVITACION_MIN, crearAcceso, linkAcceso, linkEnPantalla, perfilActivo, registrosDe } from '../../../lib/cuenta';
import { enviarAccesoCuenta } from '../../../lib/email';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * GET /api/admin/registros?id=<paciente> → "Mi registro" de la paciente (lo
 * que completó ella en su cuenta), del más nuevo al más viejo, y si el perfil
 * está prendido. Lo completó ella con su propio consentimiento, así que no
 * depende del consentimiento_fecha de la ficha.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const id = url.searchParams.get('id');
  if (!id || !UUID.test(id)) return json({ ok: false, error: 'Ficha inválida' }, 400);
  try {
    const sql = getSql();
    await ensurePerfil(sql);
    const f = (await sql`
      select registro_consentimiento_at::text as consentimiento, email is not null and email <> '' as tiene_email,
             (select max(created_at)::text from pacientes_sesiones s where s.paciente_id = pacientes.id) as ultima_entrada
        from pacientes where id = ${id}
    `) as any[];
    if (!f.length) return json({ ok: false, error: 'No existe esa ficha' }, 404);
    return json({ ok: true, activo: perfilActivo(), ...f[0], registros: await registrosDe(sql, id) });
  } catch (err) {
    console.error('admin/registros', err);
    return json({ ok: false, error: 'No se pudo cargar el registro.' }, 500);
  }
};

/**
 * POST /api/admin/registros { accion: 'invitar', id } → le manda a la paciente
 * el link para entrar directo a completar su registro. Es un envío manual (lo
 * toca Ceci) y solo con el perfil prendido.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  if (!perfilActivo()) return json({ ok: false, error: 'El perfil de pacientes todavía está apagado (PERFIL_PACIENTES_ACTIVO).' }, 409);
  const b = await request.json().catch(() => ({}));
  if (b?.accion !== 'invitar' || typeof b?.id !== 'string' || !UUID.test(b.id)) return json({ ok: false, error: 'Pedido inválido' }, 400);
  try {
    const sql = getSql();
    await ensurePerfil(sql);
    const rows = (await sql`select id, nombre, email from pacientes where id = ${b.id}`) as any[];
    const p = rows[0];
    if (!p) return json({ ok: false, error: 'No existe esa ficha' }, 404);
    if (!p.email) return json({ ok: false, error: 'La ficha no tiene email: cargalo en Datos.' }, 409);
    const token = await crearAcceso(sql, p.id, 'registro', INVITACION_MIN);
    const link = linkAcceso(baseUrl(request), token);
    if (linkEnPantalla(String(p.email).toLowerCase())) return json({ ok: true, prueba: link });
    const ok = await enviarAccesoCuenta({ nombre: p.nombre, email: p.email, link, vence: '3 días', invitacion: true });
    if (!ok) return json({ ok: false, error: 'No se pudo mandar el mail (revisá RESEND_API_KEY).' }, 502);
    return json({ ok: true });
  } catch (err) {
    console.error('admin/registros invitar', err);
    return json({ ok: false, error: 'No se pudo mandar.' }, 500);
  }
};
