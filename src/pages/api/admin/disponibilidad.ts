import type { APIRoute } from 'astro';
import { getSql, ensureFranjas, ensureDuracionMin } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function nombreSede(slug: string) {
  if (slug === 'montevideo') return 'Montevideo';
  if (slug === 'san-jose') return 'San José';
  return null; // online
}

// POST /api/admin/disponibilidad
// body: { lugar, dias: [{ fecha:'YYYY-MM-DD', horas:['HH:MM', ...], duracionMin? }], llenas: ['YYYY-MM-DD'] }
// Reemplaza la foto FUTURA de ese lugar: cada día abre exactamente sus horas; los llenos van a bloqueos.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const lugar: string = body?.lugar;
  if (!['montevideo', 'san-jose', 'online'].includes(lugar)) {
    return json({ ok: false, error: 'Lugar inválido' }, 400);
  }

  // "Hoy" en hora de Uruguay (UTC-3): el runtime corre en UTC.
  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const esFecha = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= hoy;
  const esHora = (h: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h);

  // Días llenos (bloqueos) — tienen prioridad sobre la disponibilidad
  const llenasOk: string[] = (Array.isArray(body?.llenas) ? body.llenas : []).filter(esFecha);
  const llenasSet = new Set(llenasOk);

  // Duración de la consulta: la define Ceci al abrir cada rango (5–240 min).
  const esDuracion = (v: unknown) => Number.isInteger(v) && (v as number) >= 5 && (v as number) <= 240;

  // Días disponibles, cada uno con su propio set de horas y duración
  const diasIn: any[] = Array.isArray(body?.dias) ? body.dias : [];
  const diasOk = diasIn
    .filter((d) => d && esFecha(d.fecha) && Array.isArray(d.horas) && !llenasSet.has(d.fecha))
    .map((d) => ({
      fecha: d.fecha as string,
      horas: [...new Set((d.horas as any[]).filter((h) => esHora(h)))] as string[],
      duracionMin: esDuracion(d.duracionMin) ? (d.duracionMin as number) : 30,
    }))
    .filter((d) => d.horas.length > 0);

  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureDuracionMin(sql);

    let sedeId: string | null = null;
    const nombre = nombreSede(lugar);
    if (nombre) {
      const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
      sedeId = r[0]?.id ? String(r[0].id) : null;
    }

    // Reemplazo de la foto futura de ese lugar en UNA transacción: si algo
    // falla a mitad de camino no queda la agenda borrada sin sus reemplazos.
    const queries: any[] = [];
    if (sedeId) {
      queries.push(sql`delete from franjas where sede_id = ${sedeId} and fecha >= ${hoy}`);
      queries.push(sql`delete from bloqueos where sede_id = ${sedeId} and fecha >= ${hoy}`);
    } else {
      queries.push(sql`delete from franjas where sede_id is null and fecha >= ${hoy}`);
      queries.push(sql`delete from bloqueos where sede_id is null and fecha >= ${hoy}`);
    }

    // Insertar turnos: cada día abre exactamente sus horas, con la duración que Ceci eligió
    let turnos = 0;
    for (const d of diasOk) {
      for (const h of d.horas) {
        queries.push(
          sql`insert into franjas (sede_id, fecha, hora, duracion_min) values (${sedeId}, ${d.fecha}, ${h}, ${d.duracionMin})`
        );
        turnos++;
      }
    }

    // Días marcados "llenos" → bloqueos
    for (const f of llenasOk) {
      queries.push(sql`insert into bloqueos (sede_id, fecha, motivo) values (${sedeId}, ${f}, 'lleno')`);
    }

    await sql.transaction(queries);

    return json({ ok: true, lugar, fechas: diasOk.length, turnos, llenas: llenasOk.length });
  } catch (e) {
    console.error('POST /api/admin/disponibilidad:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo guardar la disponibilidad. Probá de nuevo.' }, 500);
  }
};
