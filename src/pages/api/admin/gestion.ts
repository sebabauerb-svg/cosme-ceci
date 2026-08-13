import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion, ensureGestion } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { SENA_UYU, precioTotal } from '../../../lib/precios';

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

/** 'sábado 15 de agosto' — la fecha como la escribe Ceci en sus mensajes. */
export function fechaLarga(iso?: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-UY', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

/**
 * GET /api/admin/gestion?dias=30
 * Turnos confirmados de acá en adelante, con el estado de cobro de cada uno.
 * Es la vista de trabajo de Ceci: a quién le falta pagar, a quién recordarle.
 */
export const GET: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const dias = Math.min(120, Math.max(1, Number(new URL(request.url).searchParams.get('dias')) || 30));
  try {
    const sql = getSql();
    await ensureConfirmacion(sql);
    await ensureGestion(sql);

    // Hoy en Uruguay (UTC-3): no queremos arrastrar turnos que ya pasaron.
    const hoyUY = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

    const rows = (await sql`
      select r.id, r.modalidad, coalesce(s.nombre, '') as sede,
             r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora,
             r.nombre, r.telefono, r.email, r.estado,
             r.precio_uyu, r.total_acordado, r.sena_pagada, r.forma_pago,
             r.recordatorio_at, r.notas
        from reservas r left join sedes s on s.id = r.sede_id
       where r.estado = 'confirmada' and r.fecha is not null
         and r.fecha >= ${hoyUY}::date
         and r.fecha <= (${hoyUY}::date + ${dias}::int)
       order by r.fecha, r.hora
    `) as any[];

    const reservas = rows.map((r) => {
      // Si Ceci no fijó un total para esta consulta, vale el precio de lista.
      const total = r.total_acordado != null ? Number(r.total_acordado) : precioTotal(r.modalidad);
      const sena = r.sena_pagada != null ? Number(r.sena_pagada) : null;
      return {
        id: String(r.id),
        modalidad: NOMBRE_MODALIDAD[r.modalidad] ?? r.modalidad,
        modalidadId: r.modalidad,
        sede: r.sede || null,
        fecha: r.fecha,
        fechaLarga: fechaLarga(r.fecha),
        hora: r.hora,
        nombre: r.nombre,
        telefono: r.telefono,
        email: r.email,
        total,
        senaSugerida: SENA_UYU,
        senaPagada: sena,
        saldo: total != null ? Math.max(0, total - (sena ?? 0)) : null,
        formaPago: r.forma_pago,
        recordatorioAt: r.recordatorio_at,
        notas: r.notas,
      };
    });
    return json({ ok: true, reservas });
  } catch (e) {
    console.error('GET /api/admin/gestion:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo cargar la gestión.' }, 500);
  }
};

const FORMAS = ['mercadopago', 'transferencia', 'efectivo'];

/**
 * POST /api/admin/gestion  { id, total_acordado?, sena_pagada?, forma_pago?, notas?, recordado? }
 * Guarda lo acordado y lo cobrado. Solo pisa los campos que vienen en el body:
 * el panel manda uno por vez y no queremos que eso borre el resto.
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try { body = await request.json(); } catch { return json({ ok: false, error: 'Cuerpo inválido' }, 400); }
  const id = typeof body?.id === 'string' ? body.id : '';
  if (!id) return json({ ok: false, error: 'Falta id' }, 400);

  const num = (v: unknown) => {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) throw new Error('monto');
    return n;
  };

  try {
    const sql = getSql();
    await ensureConfirmacion(sql);
    await ensureGestion(sql);

    if ('total_acordado' in body) {
      await sql`update reservas set total_acordado = ${num(body.total_acordado)} where id = ${id}`;
    }
    if ('sena_pagada' in body) {
      const sena = num(body.sena_pagada);
      // `pagado` sigue vivo en la tabla de reservas: lo mantenemos en sync para
      // que las dos vistas no se contradigan.
      await sql`
        update reservas set sena_pagada = ${sena}, pagado = ${sena != null && sena > 0}
         where id = ${id}
      `;
    }
    if ('forma_pago' in body) {
      const f = typeof body.forma_pago === 'string' && FORMAS.includes(body.forma_pago) ? body.forma_pago : null;
      await sql`update reservas set forma_pago = ${f} where id = ${id}`;
    }
    if ('notas' in body) {
      const n = typeof body.notas === 'string' ? body.notas.slice(0, 2000) : null;
      await sql`update reservas set notas = ${n || null} where id = ${id}`;
    }
    if (body?.recordado === true) {
      await sql`update reservas set recordatorio_at = now() where id = ${id}`;
    } else if (body?.recordado === false) {
      await sql`update reservas set recordatorio_at = null where id = ${id}`;
    }
    return json({ ok: true });
  } catch (e) {
    if (e instanceof Error && e.message === 'monto') return json({ ok: false, error: 'Monto inválido' }, 400);
    console.error('POST /api/admin/gestion:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo guardar.' }, 500);
  }
};
