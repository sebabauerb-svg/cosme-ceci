import type { APIRoute } from 'astro';
import { getSql } from '../../lib/db';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

// Horarios por defecto (mientras Ceci no configure su disponibilidad).
const HORAS_DEFAULT = ['09:00', '10:30', '14:00', '15:30', '17:00'];
const DIAS = 14;

function proximosDias(n: number) {
  const out: { iso: string; label: string; dow: number }[] = [];
  const d = new Date();
  while (out.length < n) {
    d.setDate(d.getDate() + 1);
    const dow = d.getUTCDay();
    if (dow === 0) continue; // sin domingos
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('es-UY', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    out.push({ iso, label, dow });
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

    // Disponibilidad configurada por Ceci para este lugar (por día de semana)
    const conf = await sql`
      select dia_semana, to_char(hora, 'HH24:MI') as hora
      from disponibilidad
      where activo = true and coalesce(sede_id::text, 'online') = ${sedeKey}
    `;
    const porDia = new Map<number, string[]>();
    for (const row of conf as any[]) {
      const arr = porDia.get(row.dia_semana) ?? [];
      arr.push(row.hora);
      porDia.set(row.dia_semana, arr);
    }
    const usaConfig = porDia.size > 0;

    const dias = proximosDias(DIAS);
    const desde = dias[0].iso;
    const hasta = dias[dias.length - 1].iso;

    // Turnos ya tomados
    const ocupadas = await sql`
      select fecha::text as fecha, to_char(hora, 'HH24:MI') as hora
      from reservas
      where estado in ('pendiente_pago', 'confirmada')
        and fecha between ${desde} and ${hasta}
        and coalesce(sede_id::text, 'online') = ${sedeKey}
    `;
    const tomadas = new Set((ocupadas as any[]).map((o) => `${o.fecha} ${o.hora}`));

    // Fechas bloqueadas (de esta sede o globales)
    const blo = await sql`
      select fecha::text as fecha from bloqueos
      where fecha between ${desde} and ${hasta}
        and (sede_id is null or coalesce(sede_id::text, '') = ${sedeKey})
    `;
    const bloqueadas = new Set((blo as any[]).map((b) => b.fecha));

    const slots = dias
      .filter((d) => !bloqueadas.has(d.iso))
      .map((d) => {
        const base = usaConfig ? (porDia.get(d.dow) ?? []) : HORAS_DEFAULT;
        const horas = [...base].sort().filter((h) => !tomadas.has(`${d.iso} ${h}`));
        return { fecha: d.iso, label: d.label, horas };
      })
      .filter((d) => d.horas.length > 0);

    return json({ ok: true, sede, configurada: usaConfig, slots });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
};
