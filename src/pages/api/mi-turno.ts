import type { APIRoute } from 'astro';
import { getSql, ensureFranjas, ensureConfirmacion, ensureGestion } from '../../lib/db';
import { labelFecha, turnosLibres } from '../../lib/agenda';
import {
  moverReserva,
  linkAutogestion,
  fechaLarga,
  horasHasta,
  NOMBRE_MODALIDAD,
  MAX_CAMBIOS_PACIENTE,
  ANTICIPACION_MIN_H,
} from '../../lib/reprogramar';
import { notificarReprogramacion } from '../../lib/email';
import { enviarWhatsApp } from '../../lib/whatsapp';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const tokenOk = (t: unknown): t is string => typeof t === 'string' && /^[0-9a-f]{32}$/.test(t);

// Mismo criterio que /api/reservar: por instancia serverless, pero corta el
// abuso barato (probar códigos al azar, o mover un turno en loop).
const intentosPorIp = new Map<string, { count: number; resetAt: number }>();
function rateLimitOk(ip: string, max: number): boolean {
  const ahora = Date.now();
  const cur = intentosPorIp.get(ip);
  if (!cur || cur.resetAt < ahora) {
    intentosPorIp.set(ip, { count: 1, resetAt: ahora + 10 * 60 * 1000 });
    return true;
  }
  cur.count++;
  return cur.count <= max;
}
function ipDe(request: Request, clientAddress?: string) {
  try {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || 'desconocida';
  } catch {
    return 'desconocida';
  }
}

async function buscar(sql: any, token: string) {
  const rows = (await sql`
    select r.id, r.estado, r.modalidad, coalesce(r.sede_id::text, 'online') as sede_key,
           coalesce(s.nombre, '') as sede, r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora,
           r.nombre, r.cambios_paciente
      from reservas r left join sedes s on s.id = r.sede_id
     where r.token_gestion = ${token}
  `) as any[];
  return rows[0] ?? null;
}

/** Si la paciente puede cambiar el turno ella sola, y si no, por qué. */
function puedeCambiar(r: any): { ok: boolean; motivo?: string } {
  if (r.estado !== 'confirmada' || !r.fecha || !r.hora)
    return { ok: false, motivo: r.estado === 'cancelada' ? 'cancelado' : 'no_confirmado' };
  if (horasHasta(r.fecha, r.hora) < ANTICIPACION_MIN_H) return { ok: false, motivo: 'menos_24h' };
  if (Number(r.cambios_paciente ?? 0) >= MAX_CAMBIOS_PACIENTE) return { ok: false, motivo: 'tope_cambios' };
  return { ok: true };
}

/** Lo que ve la paciente. Solo el nombre de pila: el link puede reenviarse. */
function vista(r: any) {
  return {
    nombre: String(r.nombre || '').trim().split(/\s+/)[0],
    modalidad: NOMBRE_MODALIDAD[r.modalidad] ?? r.modalidad,
    sede: r.sede || null,
    fecha: r.fecha,
    fechaLarga: fechaLarga(r.fecha),
    hora: r.hora,
    cambiosRestantes: Math.max(0, MAX_CAMBIOS_PACIENTE - Number(r.cambios_paciente ?? 0)),
  };
}

/**
 * GET /api/mi-turno?c=<código>
 * El turno de la paciente y, si todavía lo puede cambiar, los horarios libres
 * de su misma sede para elegir uno nuevo.
 */
export const GET: APIRoute = async ({ url, request, clientAddress }) => {
  if (!rateLimitOk(ipDe(request, clientAddress), 40)) return json({ ok: false, error: 'Demasiados intentos. Esperá unos minutos.' }, 429);
  const token = url.searchParams.get('c');
  if (!tokenOk(token)) return json({ ok: false, error: 'Link inválido.' }, 404);
  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureConfirmacion(sql);
    await ensureGestion(sql);
    const r = await buscar(sql, token);
    if (!r) return json({ ok: false, error: 'No encontramos ese turno.' }, 404);

    const p = puedeCambiar(r);
    const slots = p.ok ? await turnosLibres(sql, r.sede_key) : [];
    return json({ ok: true, turno: vista(r), puedeCambiar: p.ok, motivo: p.motivo ?? null, slots });
  } catch (e) {
    console.error('GET /api/mi-turno:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos cargar tu turno.' }, 500);
  }
};

/**
 * POST /api/mi-turno  { c, fecha, hora }
 * La paciente pasa su turno a otro horario libre de la MISMA sede. Le llega el
 * mail con el horario nuevo y a Ceci un aviso del cambio.
 */
export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (!rateLimitOk(ipDe(request, clientAddress), 10)) return json({ ok: false, error: 'Demasiados intentos. Esperá unos minutos.' }, 429);
  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Cuerpo inválido' }, 400); }
  if (!tokenOk(body?.c)) return json({ ok: false, error: 'Link inválido.' }, 404);

  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureConfirmacion(sql);
    await ensureGestion(sql);
    const r = await buscar(sql, body.c);
    if (!r) return json({ ok: false, error: 'No encontramos ese turno.' }, 404);

    const p = puedeCambiar(r);
    if (!p.ok) return json({ ok: false, motivo: p.motivo, error: 'Este turno ya no se puede cambiar desde acá.' }, 409);

    // Siempre su misma sede: cambiar de sede (o de modalidad) se coordina con Ceci.
    const res = await moverReserva(
      sql,
      String(r.id),
      { fecha: String(body.fecha ?? ''), hora: String(body.hora ?? ''), sedeKey: r.sede_key },
      { porPaciente: true }
    );
    if (!res.ok) return json({ ok: false, error: res.error, code: res.code }, res.status);
    const t = res.turno;

    const s = (await sql`select sena_pagada, email from reservas where id = ${t.id}`) as any[];
    await notificarReprogramacion(
      {
        modalidad: t.nombreModalidad,
        sede: t.sede,
        fechaLabel: labelFecha(t.fecha),
        hora: t.hora,
        nombre: t.nombre,
        telefono: t.telefono,
        email: s[0]?.email ?? null,
        sena: s[0]?.sena_pagada != null ? Number(s[0].sena_pagada) : null,
        linkCambio: linkAutogestion(t.token),
        antesLabel: `${labelFecha(t.antes.fecha)} · ${t.antes.hora} h`,
      },
      { porPaciente: true }
    );
    // Confirmación del cambio también por WhatsApp (si está activo).
    await enviarWhatsApp('movido', t.telefono, {
      nombre: t.nombre,
      servicio: t.nombreModalidad,
      fechaLarga: fechaLarga(t.fecha),
      hora: t.hora,
      sede: t.sede,
      token: t.token,
    });

    const nuevo = await buscar(sql, body.c);
    const p2 = puedeCambiar(nuevo);
    return json({ ok: true, turno: vista(nuevo), puedeCambiar: p2.ok, motivo: p2.motivo ?? null });
  } catch (e) {
    console.error('POST /api/mi-turno:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos cambiar tu turno. Probá de nuevo.' }, 500);
  }
};
