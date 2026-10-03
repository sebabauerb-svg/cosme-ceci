import type { APIRoute } from 'astro';
import { getSql, ensureFranjas, ensureConfirmacion } from '../../lib/db';
import { sedeKeyDeSlug, turnosLibres } from '../../lib/agenda';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// GET /api/disponibilidad?sede=montevideo|san-jose|online
// Turnos que Ceci abrió (franjas) de hoy en adelante, sin los ya reservados
// (web o manual) ni las horas de hoy que ya pasaron.
export const GET: APIRoute = async ({ url }) => {
  const sede = url.searchParams.get('sede') || 'online';
  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureConfirmacion(sql);
    const sedeKey = await sedeKeyDeSlug(sql, sede);
    const slots = await turnosLibres(sql, sedeKey);

    return json({ ok: true, sede, slots, llenas: [] });
  } catch (e) {
    console.error('GET /api/disponibilidad:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos cargar la disponibilidad.' }, 500);
  }
};
