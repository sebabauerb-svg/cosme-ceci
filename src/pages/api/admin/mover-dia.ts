import type { APIRoute } from 'astro';
import { getSql, ensureFranjas, ensureConfirmacion, ensureGestion } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { moverReserva, fechaLarga } from '../../../lib/reprogramar';
import { avisarTurnoMovido } from '../../../lib/avisos';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const SEDES: Record<string, string | null> = { montevideo: 'Montevideo', 'san-jose': 'San José', online: null };

/**
 * POST /api/admin/mover-dia  { desde, hasta, sede?, avisar? }
 * Ceci suspende un día entero (puede ser uno que ya pasó) y lo pasa a otra
 * fecha con los MISMOS horarios y la misma sede. Cada turno se mueve por
 * separado: si uno choca con un turno ya tomado en la fecha nueva, ese queda
 * sin mover y se informa, y el resto sigue.
 *  - sede: 'montevideo' | 'san-jose' | 'online'; vacío = todas las sedes.
 *  - avisar: mail (y WhatsApp automático si está activo) a cada paciente.
 * Los horarios del día suspendido se cierran, y en la fecha nueva quedan
 * abiertos (y ocupados) aunque Ceci no los hubiera cargado.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Cuerpo inválido' }, 400); }
  const desde = String(body?.desde ?? '');
  const hasta = String(body?.hasta ?? '');
  const sede = String(body?.sede ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}-\d{2}$/.test(hasta))
    return json({ ok: false, error: 'Fecha inválida' }, 400);
  if (desde === hasta) return json({ ok: false, error: 'Elegí una fecha distinta.' }, 400);
  if (sede && !(sede in SEDES)) return json({ ok: false, error: 'Sede inválida' }, 400);
  const avisar = body?.avisar === true;

  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureConfirmacion(sql);
    await ensureGestion(sql);

    const sedeNombre = sede ? SEDES[sede] : undefined;
    const turnos = (await sql`
      select r.id, coalesce(r.sede_id::text, 'online') as sede_key, coalesce(s.nombre, 'Online') as sede,
             to_char(r.hora,'HH24:MI') as hora, r.nombre
        from reservas r left join sedes s on s.id = r.sede_id
       where r.estado = 'confirmada' and r.fecha = ${desde}::date and r.hora is not null
       order by r.hora
    `) as any[];
    const delDia = turnos.filter((t) =>
      sedeNombre === undefined ? true : sedeNombre === null ? t.sede_key === 'online' : t.sede === sedeNombre
    );
    if (!delDia.length) return json({ ok: false, error: 'No hay turnos confirmados ese día.' }, 404);

    const resultados: any[] = [];
    for (const t of delDia) {
      const res = await moverReserva(
        sql,
        String(t.id),
        { fecha: hasta, hora: t.hora, sedeKey: t.sede_key },
        { libre: true, cerrarAnterior: true }
      );
      if (!res.ok) {
        resultados.push({ id: String(t.id), nombre: t.nombre, hora: t.hora, sede: t.sede, ok: false, error: res.error });
        continue;
      }
      const aviso = await avisarTurnoMovido(sql, res.turno, avisar);
      resultados.push({ id: String(t.id), nombre: t.nombre, hora: t.hora, sede: t.sede, ok: true, ...aviso });
    }

    return json({
      ok: true,
      hasta,
      hastaLarga: fechaLarga(hasta),
      movidos: resultados.filter((r) => r.ok).length,
      resultados,
    });
  } catch (e) {
    console.error('POST /api/admin/mover-dia:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo mover el día.' }, 500);
  }
};
