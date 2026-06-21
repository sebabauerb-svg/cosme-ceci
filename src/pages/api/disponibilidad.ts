import type { APIRoute } from 'astro';
import { getSql } from '../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Horarios candidatos (mientras Ceci no configure su disponibilidad por sede).
const HORAS = ['09:00', '10:30', '14:00', '15:30', '17:00'];
const DIAS = 14;

function proximosDias(n: number) {
  const out: { iso: string; label: string }[] = [];
  const d = new Date();
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() === 0) continue; // sin domingos
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('es-UY', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC', // coincide con la fecha ISO (UTC) que guardamos
    });
    out.push({ iso, label });
  }
  return out;
}

function nombreSede(slug: string | null) {
  if (slug === 'montevideo') return 'Montevideo';
  if (slug === 'san-jose') return 'San José';
  return null;
}

// GET /api/disponibilidad?sede=montevideo|san-jose|online
export const GET: APIRoute = async ({ url }) => {
  const sede = url.searchParams.get('sede') || 'online';
  try {
    const sql = getSql();

    let sedeKey = 'online';
    const nombre = nombreSede(sede);
    if (nombre) {
      const r = await sql`select id from sedes where nombre = ${nombre} limit 1`;
      sedeKey = r[0]?.id ? String(r[0].id) : 'online';
    }

    const dias = proximosDias(DIAS);
    const desde = dias[0].iso;
    const hasta = dias[dias.length - 1].iso;

    // Turnos ya tomados (pendientes o confirmados) para esa sede en el rango.
    const ocupadas = await sql`
      select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora
      from reservas
      where estado in ('pendiente_pago', 'confirmada')
        and fecha between ${desde} and ${hasta}
        and coalesce(sede_id::text, 'online') = ${sedeKey}
    `;
    const tomadas = new Set(ocupadas.map((o: any) => `${o.fecha} ${o.hora}`));

    const slots = dias
      .map((d) => ({
        fecha: d.iso,
        label: d.label,
        horas: HORAS.filter((h) => !tomadas.has(`${d.iso} ${h}`)),
      }))
      .filter((d) => d.horas.length > 0);

    return json({ ok: true, sede, slots });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
