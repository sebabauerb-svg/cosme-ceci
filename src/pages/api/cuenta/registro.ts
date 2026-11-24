import type { APIRoute } from 'astro';
import { getSql, ensurePerfil } from '../../../lib/db';
import { pacienteActual, perfilActivo, registroValido } from '../../../lib/cuenta';

export const prerender = false;

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/**
 * POST /api/cuenta/registro
 *   { accion: 'consentir', acepto: true } → acepta que se guarde su registro
 *   { accion: 'guardar', ...campos }      → agrega una entrada con la fecha de hoy
 * Es dato de salud: sin registro_consentimiento_at no se guarda nada (409).
 * La paciente agrega entradas; no edita ni borra las anteriores (son la
 * evolución). Para borrar todo, se lo pide a Ceci (derecho de supresión).
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!perfilActivo()) return json({ ok: false, error: 'No disponible' }, 404);
  try {
    const sql = getSql();
    await ensurePerfil(sql);
    const p = await pacienteActual(sql, cookies);
    if (!p) return json({ ok: false, error: 'Tu sesión venció. Entrá de nuevo con el link de tu email.' }, 401);
    const b = await request.json().catch(() => ({}));

    if (b?.accion === 'consentir') {
      if (b?.acepto !== true) return json({ ok: false, error: 'Marcá la casilla para continuar.' }, 400);
      await sql`update pacientes set registro_consentimiento_at = coalesce(registro_consentimiento_at, now()) where id = ${p.id}`;
      return json({ ok: true });
    }

    if (b?.accion === 'guardar') {
      if (!p.registro_consentimiento_at)
        return json({ ok: false, error: 'Antes de guardar, aceptá cómo se usan tus datos.' }, 409);
      const r = registroValido(b);
      if (!r) return json({ ok: false, error: 'Completá al menos una parte del registro.' }, 400);
      await sql`
        insert into registros_piel
          (paciente_id, fecha, nota, sensaciones, sensaciones_texto, objetivos, objetivos_texto, productos, cambios, habitos)
        values (${p.id}, ${r.fecha}, ${r.nota}, ${r.sensaciones}, ${r.sensaciones_texto || null}, ${r.objetivos},
                ${r.objetivos_texto || null}, ${JSON.stringify(r.productos)}::jsonb, ${r.cambios || null}, ${r.habitos})
      `;
      return json({ ok: true });
    }
    return json({ ok: false, error: 'Acción inválida' }, 400);
  } catch (err) {
    console.error('cuenta/registro', err);
    return json({ ok: false, error: 'No pudimos guardar. Probá de nuevo.' }, 500);
  }
};
