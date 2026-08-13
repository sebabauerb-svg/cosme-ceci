import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion, ensureGestion } from '../../../lib/db';
import { notificarRecordatorio } from '../../../lib/email';
import { precioTotal } from '../../../lib/precios';

export const prerender = false;

const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  club: 'Club de las Estaciones',
  manual: 'Reserva manual',
};

function labelFecha(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-UY', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    });
  } catch { return iso; }
}

/**
 * GET /api/cron/recordatorios — lo llama el cron de Vercel (ver vercel.json),
 * una vez por día a las 13:00 UTC (10:00 en Uruguay).
 *
 * Manda el recordatorio por mail de los turnos de MAÑANA que todavía no fueron
 * recordados, y marca `recordatorio_at`. Esa marca es la que evita duplicados:
 * si el cron corre dos veces, la segunda no encuentra nada que mandar. Es la
 * misma marca que usa el botón de WhatsApp del panel, así que un canal no pisa
 * al otro.
 *
 * Seguridad: Vercel manda `Authorization: Bearer $CRON_SECRET`. Sin secret
 * configurado, en producción no corre (fail-closed): el endpoint es público y
 * sin esto cualquiera podría dispararle mails a las pacientes.
 */
export const GET: APIRoute = async ({ request }) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    if (request.headers.get('authorization') !== `Bearer ${secret}`) {
      return new Response('no autorizado', { status: 401 });
    }
  } else if (import.meta.env.PROD) {
    console.error('cron recordatorios: CRON_SECRET sin configurar — no se ejecuta');
    return new Response('secret no configurado', { status: 401 });
  }

  try {
    const sql = getSql();
    await ensureConfirmacion(sql);
    await ensureGestion(sql);

    // Mañana en Uruguay (UTC-3). El turno de mañana es el que se recuerda hoy.
    const manana = new Date(Date.now() - 3 * 3600 * 1000 + 24 * 3600 * 1000)
      .toISOString()
      .slice(0, 10);

    const rows = (await sql`
      select r.id, r.modalidad, coalesce(s.nombre, '') as sede,
             r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora,
             r.nombre, r.telefono, r.email, r.total_acordado, r.sena_pagada
        from reservas r left join sedes s on s.id = r.sede_id
       where r.estado = 'confirmada' and r.fecha = ${manana}::date
         and r.recordatorio_at is null and r.email is not null
       order by r.hora
    `) as any[];

    let enviados = 0;
    for (const r of rows) {
      const total = r.total_acordado != null ? Number(r.total_acordado) : precioTotal(r.modalidad);
      const sena = r.sena_pagada != null ? Number(r.sena_pagada) : null;
      await notificarRecordatorio({
        modalidad: NOMBRE_MODALIDAD[r.modalidad] ?? r.modalidad,
        sede: r.sede || null,
        fechaLabel: labelFecha(r.fecha),
        hora: r.hora,
        nombre: r.nombre,
        telefono: r.telefono,
        email: r.email,
        saldo: total != null ? Math.max(0, total - (sena ?? 0)) : null,
      });
      // Se marca aunque el mail falle: notificarRecordatorio no lanza, y preferimos
      // un recordatorio perdido antes que reenviarlo en loop al día siguiente.
      await sql`update reservas set recordatorio_at = now() where id = ${r.id}`;
      enviados++;
    }

    console.log(`cron recordatorios: ${enviados} enviado(s) para ${manana}`);
    return new Response(JSON.stringify({ ok: true, fecha: manana, enviados }), {
      headers: { 'content-type': 'application/json' },
    });
  } catch (e) {
    console.error('cron recordatorios:', e instanceof Error ? e.message : e);
    return new Response('error', { status: 500 });
  }
};
