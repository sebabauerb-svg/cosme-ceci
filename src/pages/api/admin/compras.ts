import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion, ensureGestion, ensureCompras } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { formatMonto } from '../../../lib/compras';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

/**
 * GET /api/admin/compras
 * Compras del Club y de paquetes hechas por la web (src/lib/compras.ts): qué se
 * compró, cuánto se pagó, en qué moneda, por qué medio y en cuántas cuotas.
 * Lista las pagadas y las que están en curso (no las vencidas sin pagar).
 */
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  try {
    const sql = getSql();
    await ensureConfirmacion(sql);
    await ensureGestion(sql);
    await ensureCompras(sql);
    const rows = (await sql`
      select id, producto_nombre, producto, moneda, precio_lista, monto_esperado, via_pago,
             estado, pagado, monto_cobrado, forma_pago, mp_estado, mp_cuotas, mp_moneda,
             nombre, telefono, email,
             created_at::text as creada, pagado_at::text as pagado_at
        from reservas
       where producto is not null
         and (estado = 'confirmada' or mp_estado is not null
              or (estado in ('pendiente_pago','a_confirmar') and (expira_at is null or expira_at > now())))
       order by coalesce(pagado_at, created_at) desc
       limit 100
    `) as any[];

    const compras = rows.map((r) => {
      const moneda = r.mp_moneda || r.moneda || 'UYU';
      const cobrado = r.monto_cobrado != null ? Number(r.monto_cobrado) : null;
      let estado: string;
      if (r.estado === 'confirmada' && r.pagado) estado = 'Pagada';
      else if (r.estado === 'confirmada') estado = 'Confirmada · sin pago registrado';
      else if (r.mp_estado === 'approved_monto_distinto') estado = 'Pago con monto distinto: revisar';
      else if (r.estado === 'cancelada') estado = r.mp_estado === 'refunded' ? 'Devuelta' : 'Cancelada';
      else if (r.mp_estado === 'rejected') estado = 'Pago rechazado';
      else if (r.mp_estado === 'pending' || r.mp_estado === 'in_process') estado = 'Pago en acreditación';
      else if (r.estado === 'a_confirmar') estado = 'Esperando transferencia';
      else if (r.estado === 'pendiente_pago') estado = 'Pagando con Mercado Pago';
      else estado = r.estado;
      return {
        id: String(r.id),
        producto: r.producto_nombre ?? r.producto,
        nombre: r.nombre,
        telefono: r.telefono,
        email: r.email,
        estado,
        pagada: r.estado === 'confirmada' && !!r.pagado,
        medio:
          (r.forma_pago || r.via_pago) === 'mercadopago'
            ? 'Mercado Pago'
            : (r.forma_pago || r.via_pago) === 'transferencia'
              ? 'Transferencia'
              : r.forma_pago || r.via_pago || '—',
        cuotas: r.mp_cuotas != null ? Number(r.mp_cuotas) : null,
        cobrado: cobrado != null ? formatMonto(cobrado, moneda) : null,
        esperado: r.monto_esperado != null ? formatMonto(Number(r.monto_esperado), r.moneda) : null,
        lista: r.precio_lista != null ? formatMonto(Number(r.precio_lista), r.moneda) : null,
        // Club Premium (en dólares) cobrado en pesos por Mercado Pago.
        nota:
          r.mp_moneda && r.moneda && r.mp_moneda !== r.moneda && r.monto_esperado != null
            ? `${formatMonto(Number(r.monto_esperado), r.moneda)} convertido por Mercado Pago`
            : null,
        fecha: r.pagado_at || r.creada,
      };
    });
    return json({ ok: true, compras });
  } catch (e) {
    console.error('GET /api/admin/compras:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudieron cargar las compras.' }, 500);
  }
};
