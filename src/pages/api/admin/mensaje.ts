import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion, ensureGestion } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { SENA_UYU, precioTotal } from '../../../lib/precios';
import { generarMensaje, linkWhatsApp, PLANTILLAS, type PlantillaId } from '../../../lib/mensajes';
import { fechaLarga } from './gestion';

export const prerender = false;

const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  club: 'Club de las Estaciones',
  manual: 'Reserva manual',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * POST /api/admin/mensaje  { id, plantilla }
 * Devuelve el mensaje ya armado con los datos actuales de la reserva, listo para
 * copiar, y el link de wa.me. Se genera en el servidor (no en el panel) para que
 * use siempre los mismos datos de cobro que se acaban de guardar.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Cuerpo inválido' }, 400); }
  const id = typeof body?.id === 'string' ? body.id : '';
  const plantilla = String(body?.plantilla ?? '') as PlantillaId;
  if (!id) return json({ ok: false, error: 'Falta id' }, 400);
  if (!PLANTILLAS.some((p) => p.id === plantilla)) return json({ ok: false, error: 'Plantilla inválida' }, 400);

  try {
    const sql = getSql();
    await ensureConfirmacion(sql);
    await ensureGestion(sql);

    const rows = (await sql`
      select r.modalidad, coalesce(s.nombre, '') as sede,
             r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora,
             r.nombre, r.telefono, r.total_acordado, r.sena_pagada
        from reservas r left join sedes s on s.id = r.sede_id
       where r.id = ${id}
    `) as any[];
    const r = rows[0];
    if (!r) return json({ ok: false, error: 'No encontramos esa reserva.' }, 404);

    const total = r.total_acordado != null ? Number(r.total_acordado) : precioTotal(r.modalidad);
    const senaPagada = r.sena_pagada != null ? Number(r.sena_pagada) : null;
    const texto = generarMensaje(plantilla, {
      nombre: r.nombre,
      modalidad: NOMBRE_MODALIDAD[r.modalidad] ?? r.modalidad,
      fechaLarga: fechaLarga(r.fecha),
      hora: r.hora,
      sede: r.sede || null,
      sena: SENA_UYU,
      senaPagada,
      saldo: total != null ? Math.max(0, total - (senaPagada ?? 0)) : null,
    });

    return json({
      ok: true,
      texto,
      wa: r.telefono && r.telefono !== '—' ? linkWhatsApp(r.telefono, texto) : null,
    });
  } catch (e) {
    console.error('POST /api/admin/mensaje:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo generar el mensaje.' }, 500);
  }
};
