/**
 * PAQUETE PAGADO → PLAN EN LA FICHA
 * ================================
 * Cuando una compra de paquete queda paga (webhook de Mercado Pago o Ceci
 * confirma la transferencia desde el panel), se crea el plan de la paciente con
 * sus sesiones (crearPlanDesdeCompra, src/lib/planes-agenda.ts). Así puede
 * agendarlas desde Mi cuenta cuando Ceci lo habilita, o sola si está prendido
 * PLANES_AUTO_DESDE_COMPRA=true.
 *
 * Idempotente (planes.compra_id = id de la reserva-compra) y nunca lanza: un
 * error acá no puede trabar la confirmación del pago.
 */
import { ensurePacientes, ensurePlanesAgenda } from './db';
import { vincularPendientes } from './pacientes';
import { crearPlanDesdeCompra } from './planes-agenda';
import { categoriasTratamientos } from '../data/tratamientos';

/** 'paquete6:ultracavitacion' → { sesiones: 6, tratamientoId: 'ultracavitacion' } */
export function leerProductoPaquete(producto: unknown): { sesiones: number; tratamientoId: string } | null {
  const m = typeof producto === 'string' ? /^paquete(\d+):(.+)$/.exec(producto) : null;
  if (!m) return null;
  return { sesiones: Number(m[1]), tratamientoId: m[2] };
}

export async function planDesdePaquetePagado(
  sql: any,
  reservaId: string,
  medio: 'mercadopago' | 'transferencia'
): Promise<string | null> {
  try {
    const rows = (await sql`select producto, paciente_id from reservas where id = ${reservaId}`) as any[];
    const paq = leerProductoPaquete(rows[0]?.producto);
    if (!paq) return null; // no es un paquete (Club, sesión suelta…)

    await ensurePacientes(sql);
    await ensurePlanesAgenda(sql);

    let pacienteId: string | null = rows[0]?.paciente_id ? String(rows[0].paciente_id) : null;
    if (!pacienteId) {
      // La ficha se vincula al reservar; si falló entonces, se reintenta acá.
      await vincularPendientes(sql, reservaId);
      const r2 = (await sql`select paciente_id from reservas where id = ${reservaId}`) as any[];
      pacienteId = r2[0]?.paciente_id ? String(r2[0].paciente_id) : null;
    }
    if (!pacienteId) {
      console.error('Plan desde compra: la reserva no tiene ficha de paciente', reservaId);
      return null;
    }

    const t = categoriasTratamientos.flatMap((c) => c.tratamientos).find((x) => x.id === paq.tratamientoId);
    return await crearPlanDesdeCompra(sql, {
      pacienteId,
      compraId: reservaId,
      tratamientoId: t ? t.id : null,
      tratamiento: t?.nombre ?? paq.tratamientoId,
      sesiones: paq.sesiones,
      paquete: `${paq.sesiones} sesiones, pagado por la web (${medio === 'mercadopago' ? 'Mercado Pago' : 'transferencia'})`,
    });
  } catch (e) {
    console.error('Plan desde compra:', e instanceof Error ? e.message : e);
    return null;
  }
}
