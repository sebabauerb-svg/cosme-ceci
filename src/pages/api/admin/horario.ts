import type { APIRoute } from 'astro';
import { getSql } from '../../../lib/db';
import { ensureHorarioSemanal } from '../../../lib/agenda';
import { isAdmin } from '../../../lib/admin';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const SEDE_NOMBRE: Record<string, string | null> = {
  montevideo: 'Montevideo',
  'san-jose': 'San José',
  online: null,
};

// POST /api/admin/horario
// body: {
//   bloques: [{ sede:'montevideo'|'san-jose'|'online', dia:0..6, desde:'HH:MM', hasta:'HH:MM', duracion:int }],
//   excepciones: ['YYYY-MM-DD', ...]   // días que no atiende (feriados/viajes)
// }
// Reemplaza TODO el horario semanal y las excepciones (una sola foto). Guarda
// en una transacción para no dejar la agenda a medias.
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const esHora = (h: unknown) => typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
  const esFecha = (f: unknown) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f);
  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

  const bloquesIn: any[] = Array.isArray(body?.bloques) ? body.bloques : [];
  const bloques = bloquesIn
    .filter(
      (b) =>
        b &&
        b.sede in SEDE_NOMBRE &&
        Number.isInteger(b.dia) &&
        b.dia >= 0 &&
        b.dia <= 6 &&
        esHora(b.desde) &&
        esHora(b.hasta) &&
        b.desde < b.hasta &&
        Number.isInteger(b.duracion) &&
        b.duracion >= 5 &&
        b.duracion <= 240
    )
    .map((b) => ({ sede: b.sede as string, dia: b.dia as number, desde: b.desde as string, hasta: b.hasta as string, duracion: b.duracion as number }));

  // Solo excepciones de hoy en adelante (no tiene sentido bloquear el pasado)
  const excepciones = [...new Set((Array.isArray(body?.excepciones) ? body.excepciones : []).filter(esFecha).filter((f: string) => f >= hoy))] as string[];

  try {
    const sql = getSql();
    await ensureHorarioSemanal(sql);

    // Resolver los uuid de las sedes físicas una sola vez.
    const sedes = (await sql`select id, nombre from sedes`) as { id: string; nombre: string }[];
    const idDeSede = (slug: string): string | null => {
      const nombre = SEDE_NOMBRE[slug];
      if (!nombre) return null; // online
      const s = sedes.find((x) => x.nombre === nombre);
      return s ? String(s.id) : null;
    };

    const queries: any[] = [
      sql`delete from horario_semanal`,
      sql`delete from bloqueos`, // los bloqueos ahora son solo excepciones globales
    ];
    for (const b of bloques) {
      const sedeId = idDeSede(b.sede);
      queries.push(
        sql`insert into horario_semanal (sede_id, dia_semana, hora_desde, hora_hasta, duracion_min)
            values (${sedeId}, ${b.dia}, ${b.desde}, ${b.hasta}, ${b.duracion})`
      );
    }
    for (const f of excepciones) {
      queries.push(sql`insert into bloqueos (sede_id, fecha, motivo) values (null, ${f}, 'no atiende')`);
    }

    await sql.transaction(queries);
    return json({ ok: true, bloques: bloques.length, excepciones: excepciones.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('POST /api/admin/horario:', msg);
    return json({ ok: false, error: 'No se pudo guardar el horario. Probá de nuevo.', detalle: msg }, 500);
  }
};

// DELETE /api/admin/horario  → borra TODO el horario semanal y las excepciones.
export const DELETE: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const sql = getSql();
    await ensureHorarioSemanal(sql);
    const [h, b] = await sql.transaction([
      sql`delete from horario_semanal returning id`,
      sql`delete from bloqueos returning id`,
    ]);
    return json({ ok: true, bloques: (h as any[]).length, excepciones: (b as any[]).length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('DELETE /api/admin/horario:', msg);
    return json({ ok: false, error: 'No se pudo borrar el horario. Probá de nuevo.', detalle: msg }, 500);
  }
};
