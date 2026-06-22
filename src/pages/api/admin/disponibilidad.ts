import type { APIRoute } from 'astro';
import { getSql, ensureFranjas } from '../../../lib/db';
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

// Intervalo de turnos por sede (min) y corte Mañana/Tarde — debe coincidir con el panel
const SEDE_INTERVALO: Record<string, number> = { montevideo: 45, 'san-jose': 30, online: 30 };
const CORTE = '13:00';
function genHoras(step: number, start = '08:00', end = '20:30') {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const out: string[] = [];
  for (let t = sh * 60 + sm; t <= eh * 60 + em; t += step) {
    out.push(`${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`);
  }
  return out;
}
function horasDeBloque(slug: string, bloque: string): string[] {
  const todas = genHoras(SEDE_INTERVALO[slug] ?? 30);
  if (bloque === 'manana') return todas.filter((h) => h < CORTE);
  if (bloque === 'tarde') return todas.filter((h) => h >= CORTE);
  return todas; // 'dia'
}

// POST /api/admin/disponibilidad
// body: { lugar, dias: [{ fecha:'YYYY-MM-DD', bloque:'manana'|'tarde'|'dia' }], llenas: ['YYYY-MM-DD'] }
// Reemplaza la foto FUTURA de ese lugar: cada día abre los turnos de su bloque; los llenos van a bloqueos.
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

  const hoy = new Date().toISOString().slice(0, 10);
  const esFecha = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= hoy;

  // Días llenos (bloqueos) — tienen prioridad sobre la disponibilidad
  const llenasOk: string[] = (Array.isArray(body?.llenas) ? body.llenas : []).filter(esFecha);
  const llenasSet = new Set(llenasOk);

  // Días disponibles con su bloque
  const diasIn: any[] = Array.isArray(body?.dias) ? body.dias : [];
  const diasOk = diasIn.filter(
    (d) => d && esFecha(d.fecha) && ['manana', 'tarde', 'dia'].includes(d.bloque) && !llenasSet.has(d.fecha)
  );

  try {
    const sql = getSql();
    await ensureFranjas(sql);

    let sedeId: string | null = null;
    const nombre = nombreSede(lugar);
    if (nombre) {
      const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
      sedeId = r[0]?.id ? String(r[0].id) : null;
    }

    // Borrar la foto futura de ese lugar (no tocamos el pasado)
    if (sedeId) {
      await sql`delete from franjas where sede_id = ${sedeId} and fecha >= ${hoy}`;
      await sql`delete from bloqueos where sede_id = ${sedeId} and fecha >= ${hoy}`;
    } else {
      await sql`delete from franjas where sede_id is null and fecha >= ${hoy}`;
      await sql`delete from bloqueos where sede_id is null and fecha >= ${hoy}`;
    }

    // Insertar turnos: cada día abre las horas de su bloque
    let turnos = 0;
    for (const d of diasOk) {
      for (const h of horasDeBloque(lugar, d.bloque)) {
        await sql`insert into franjas (sede_id, fecha, hora) values (${sedeId}, ${d.fecha}, ${h})`;
        turnos++;
      }
    }

    // Días marcados "llenos" → bloqueos
    for (const f of llenasOk) {
      await sql`insert into bloqueos (sede_id, fecha, motivo) values (${sedeId}, ${f}, 'lleno')`;
    }

    return json({ ok: true, lugar, fechas: diasOk.length, turnos, llenas: llenasOk.length });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
