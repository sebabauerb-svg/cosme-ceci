import type { APIRoute } from 'astro';
import { getSql, ensureGoogleEventId, ensureConfirmacion, ensureGestion, ensureCompras } from '../../../lib/db';
import {
  obtenerPago,
  verificarFirmaWebhook,
  webhookSecretConfigurado,
} from '../../../lib/mercadopago';
import {
  notificarReservaConfirmada,
  alertarPagoSinTurno,
  notificarCompraConfirmada,
} from '../../../lib/email';
import { formatMonto, mismoMonto, PAQUETE_ID, esProductoSesion } from '../../../lib/compras';
import { planDesdePaquetePagado } from '../../../lib/compras-plan';
import { crearEventoReserva } from '../../../lib/calendar';
import { sedeConDireccion } from '../../../data/sedes';
import { linkAutogestion, fechaLarga } from '../../../lib/reprogramar';
import { enviarWhatsApp } from '../../../lib/whatsapp';

export const prerender = false;

const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  sesion: 'Sesión de tratamiento',
  club: 'Club de las Estaciones',
  'club-premium': 'Club de las Estaciones Premium',
};

function labelFecha(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-UY', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

// POST /api/mp/webhook  → MercadoPago avisa de un pago.
// No confiamos en el body: tomamos el id y CONSULTAMOS el pago real a la API.
// Si está aprobado, confirmamos la reserva (queda 'confirmada' y el cupo ocupado).
export const POST: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const dataIdParam = url.searchParams.get('data.id');
    let topic = url.searchParams.get('type') || url.searchParams.get('topic');
    let paymentId = dataIdParam || url.searchParams.get('id');

    if (!paymentId) {
      const body = await request.json().catch(() => ({} as any));
      topic = topic || body?.type || body?.action;
      paymentId = body?.data?.id || body?.id || null;
    }

    // Solo nos interesan notificaciones de pago (antes de exigir firma: los
    // merchant_order / IPN legacy llegan sin x-signature y no deben dar 401).
    if (topic && !String(topic).includes('payment')) return new Response('ok', { status: 200 });
    if (!paymentId) return new Response('ok', { status: 200 });
    if (!/^\d+$/.test(String(paymentId))) return new Response('ok', { status: 200 }); // id no numérico

    // Verificación de firma HMAC. MP firma el manifest con el data.id del query;
    // no se debe calcular con ids sacados del body.
    if (webhookSecretConfigurado()) {
      if (!dataIdParam) {
        // Notificación de pago sin data.id (formato IPN viejo): no viene firmada.
        // La ignoramos; el webhook moderno con data.id es el que confirma.
        return new Response('ok', { status: 200 });
      }
      const firmaOk = verificarFirmaWebhook({
        xSignature: request.headers.get('x-signature'),
        xRequestId: request.headers.get('x-request-id'),
        dataId: dataIdParam,
      });
      if (!firmaOk) {
        console.error('MP webhook: firma inválida — descartado');
        return new Response('firma inválida', { status: 401 });
      }
    } else if (import.meta.env.PROD) {
      // Fail-closed en producción: el secret es requisito de go-live. Sin firma
      // no procesamos pagos (cualquiera podría bombardear el endpoint).
      console.error('MP webhook: MP_WEBHOOK_SECRET sin configurar en producción — descartado');
      return new Response('secret no configurado', { status: 401 });
    } else {
      console.warn('MP webhook: MP_WEBHOOK_SECRET sin configurar — firma NO verificada (dev)');
    }

    const pago = await obtenerPago(String(paymentId));
    if (!pago) return new Response('ok', { status: 200 });

    const reservaId: string | null = pago.external_reference ?? pago.metadata?.reserva_id ?? null;
    const estado: string = pago.status; // approved | pending | in_process | rejected | ...
    if (!reservaId) return new Response('ok', { status: 200 });

    const sql = getSql();
    await ensureConfirmacion(sql);
    await ensureGestion(sql);
    await ensureCompras(sql);

    if (estado === 'approved') {
      // ¿Es una compra (Club o paquete)? Tiene su propia validación: monto Y
      // moneda contra lo que fijó el servidor. La seña sigue el camino de siempre.
      const compraRow = (await sql`
        select producto, producto_nombre, moneda, monto_esperado, nombre, telefono, email
          from reservas where id = ${reservaId} and producto is not null and producto not like 'sesion:%'
      `) as any[];
      if (compraRow.length && process.env.VERCEL_ENV === 'preview') {
        // DIAGNÓSTICO TEMPORAL (solo preview): qué trae MP cuando la preferencia
        // es en USD y cobra en pesos. Solo campos de montos; nada de la pagadora.
        try {
          const it = (pago.additional_info?.items ?? []).map((i: any) => ({ unit_price: i.unit_price, currency_id: i.currency_id, quantity: i.quantity }));
          const diag: any = {
            keys: Object.keys(pago),
            currency_id: pago.currency_id, transaction_amount: pago.transaction_amount,
            transaction_details: pago.transaction_details, installments: pago.installments,
            order: pago.order, metadata: pago.metadata, items: it,
            currency_conversion: pago.currency_conversion, exchange_rate: pago.exchange_rate,
            fee_details: pago.fee_details, charges_details: (pago.charges_details ?? []).map((c: any) => ({ name: c.name, type: c.type, amounts: c.amounts })),
            point_of_interaction_type: pago.point_of_interaction?.type,
          };
          if (pago.order?.id) {
            const { obtenerOrden } = await import('../../../lib/mercadopago');
            const o = await obtenerOrden(String(pago.order.id));
            if (o) diag.orden = { preference_id: o.preference_id, total_amount: o.total_amount, paid_amount: o.paid_amount, items: (o.items ?? []).map((i: any) => ({ unit_price: i.unit_price, currency_id: i.currency_id, quantity: i.quantity })), payments: (o.payments ?? []).map((p: any) => ({ id: p.id, transaction_amount: p.transaction_amount, total_paid_amount: p.total_paid_amount, currency_id: p.currency_id, status: p.status })) };
          }
          console.log('MP DIAG compra', reservaId, JSON.stringify(diag));
        } catch (e) {
          console.error('MP DIAG error', e instanceof Error ? e.message : e);
        }
      }
      if (compraRow.length) {
        await confirmarCompra(sql, pago, String(paymentId), reservaId, compraRow[0]);
        return new Response('ok', { status: 200 });
      }

      // Integridad de monto: el pago debe coincidir con el precio que registramos
      // server-side. Defensa extra contra manipulación del monto.
      // Seña o sesión pagada completa (producto 'sesion:<id>'): las dos validan
      // contra precio_uyu, que fijó el servidor al reservar.
      const prev = (await sql`
        select precio_uyu, nombre, telefono, email, producto from reservas where id = ${reservaId}
      `) as any[];
      const esTotal = esProductoSesion(prev[0]?.producto);
      const precioEsperado = prev[0]?.precio_uyu != null ? Number(prev[0].precio_uyu) : null;
      const montoPagado =
        typeof pago.transaction_amount === 'number' ? Math.round(pago.transaction_amount) : null;
      // Todo lo que no es compra del Club/paquete se cobra en pesos.
      const monedaOk = !pago.currency_id || pago.currency_id === 'UYU';
      if ((precioEsperado != null && montoPagado != null && montoPagado !== precioEsperado) || !monedaOk) {
        // Hay plata acreditada que no confirma turno: dejar rastro y avisar a Ceci
        // (MP recibe 200 y no reintenta; sin esto nadie se entera).
        console.error(
          `MP webhook: monto no coincide (esperado ${precioEsperado}, pagado ${montoPagado}) reserva ${reservaId} — no se confirma`
        );
        await sql`
          update reservas set mp_payment_id = ${String(paymentId)}, mp_estado = 'approved_monto_distinto'
          where id = ${reservaId}
        `;
        await alertarPagoSinTurno({
          motivo: `El monto pagado ($${montoPagado}) no coincide con el precio del servicio ($${precioEsperado}). El turno NO se confirmó.`,
          paymentId: String(paymentId),
          reservaId,
          nombre: prev[0]?.nombre,
          telefono: prev[0]?.telefono,
          email: prev[0]?.email,
          monto: montoPagado,
        });
        return new Response('ok', { status: 200 });
      }

      // Confirmar solo si todavía no estaba confirmada (idempotente + un solo email).
      // Lo que entró por MercadoPago es la seña: queda anotada como tal, así el
      // panel la muestra "Señado · MercadoPago" y el recordatorio cobra solo el saldo.
      const sena = montoPagado ?? precioEsperado;
      let upd: any[];
      try {
        upd = await sql`
          update reservas
             set estado = 'confirmada', expira_at = null,
                 mp_payment_id = ${String(paymentId)}, mp_estado = ${estado},
                 sena_pagada = coalesce(sena_pagada, ${sena}), pagado = true,
                 monto_cobrado = coalesce(monto_cobrado, ${sena}),
                 forma_pago = coalesce(forma_pago, 'mercadopago')
           where id = ${reservaId} and estado in ('pendiente_pago', 'expirada')
           returning id
        `;
      } catch (e: any) {
        // 23505 = el cupo lo tomó otra reserva mientras tanto (pago tardío). No se puede confirmar.
        if (e?.code === '23505' || String(e?.message ?? e).includes('reservas_slot_unico')) {
          console.error('MP webhook: cupo ya ocupado, pago aprobado sin confirmar reserva', reservaId);
          await sql`
            update reservas set mp_payment_id = ${String(paymentId)}, mp_estado = 'approved_sin_cupo'
            where id = ${reservaId}
          `;
          await alertarPagoSinTurno({
            motivo: 'La clienta pagó, pero el horario ya lo tomó otra reserva. Hay que reprogramarla o devolverle el dinero.',
            paymentId: String(paymentId),
            reservaId,
            nombre: prev[0]?.nombre,
            telefono: prev[0]?.telefono,
            email: prev[0]?.email,
            monto: montoPagado,
          });
          return new Response('ok', { status: 200 });
        }
        throw e;
      }

      if (upd.length) {
        const r = (await sql`
          select r.modalidad, coalesce(s.nombre, '') as sede,
                 r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora,
                 r.nombre, r.telefono, r.email, r.duracion_min, r.token_gestion
          from reservas r left join sedes s on s.id = r.sede_id
          where r.id = ${reservaId}
        `) as any[];
        const d = r[0];
        // Cuotas y moneda del pago (para el panel). Nunca traba la confirmación.
        try {
          await sql`
            update reservas
               set mp_cuotas = ${Number.isInteger(pago.installments) ? Number(pago.installments) : null},
                   mp_moneda = ${pago.currency_id ?? null}, mp_monto = ${pago.transaction_amount ?? null},
                   pagado_at = now(),
                   total_acordado = coalesce(${esTotal ? precioEsperado : null}::numeric, total_acordado)
             where id = ${reservaId}
          `;
        } catch (e) {
          console.error('MP webhook: no se pudieron guardar las cuotas:', e instanceof Error ? e.message : e);
        }
        if (d) {
          const nombreModalidad = NOMBRE_MODALIDAD[d.modalidad] ?? d.modalidad;
          await notificarReservaConfirmada({
            modalidad: nombreModalidad,
            sede: d.sede || null,
            fechaLabel: labelFecha(d.fecha),
            hora: d.hora,
            nombre: d.nombre,
            telefono: d.telefono,
            email: d.email,
            // Lo cobrado por la web es la seña; el resto se abona en la consulta.
            // (Salvo la sesión pagada completa: no queda saldo.)
            sena,
            pagoTotal: esTotal,
            linkCambio: linkAutogestion(d.token_gestion),
          });
          // Mismo aviso por WhatsApp, desde el número de Ceci (si está activo).
          await enviarWhatsApp('confirmado', d.telefono, {
            nombre: d.nombre,
            servicio: nombreModalidad,
            fechaLarga: fechaLarga(d.fecha),
            hora: d.hora,
            sede: d.sede || null,
            token: d.token_gestion,
          });

          // Evento en el Google Calendar de Ceci (solo turnos con fecha/hora).
          if (d.fecha && d.hora) {
            // Duración real de la franja que Ceci abrió; fallback al valor
            // histórico por sede para reservas de antes de tener duracion_min.
            const duracionMin =
              d.duracion_min != null ? Number(d.duracion_min) : d.sede === 'Montevideo' ? 45 : 30;
            const ev = await crearEventoReserva({
              resumen: `${nombreModalidad} — ${d.nombre}`,
              descripcion: [
                `Servicio: ${nombreModalidad}`,
                d.sede ? `Sede: ${sedeConDireccion(d.sede)}` : 'Online',
                `Cliente: ${d.nombre}`,
                `WhatsApp: ${d.telefono}`,
                d.email ? `Email: ${d.email}` : '',
              ]
                .filter(Boolean)
                .join('\n'),
              fecha: d.fecha,
              hora: d.hora,
              duracionMin,
            });
            if (ev.ok && ev.eventId) {
              try {
                await ensureGoogleEventId(sql);
                await sql`update reservas set google_event_id = ${ev.eventId} where id = ${reservaId}`;
              } catch (e) {
                console.error('No se pudo guardar google_event_id:', e instanceof Error ? e.message : e);
              }
            }
          }
        }
      }
    } else if (estado === 'pending' || estado === 'in_process' || estado === 'authorized') {
      // Pago en curso (ej. Abitab/Redpagos demora horas): además de registrar el
      // estado, extendemos la reserva para que el cupo no se libere a los 30 min
      // con un pago en camino.
      await sql`
        update reservas
           set mp_payment_id = ${String(paymentId)}, mp_estado = ${estado},
               expira_at = greatest(coalesce(expira_at, now()), now() + interval '2 days')
        where id = ${reservaId} and estado = 'pendiente_pago'
      `;
    } else if (estado === 'refunded' || estado === 'charged_back') {
      // Devolución o contracargo de un pago que ya había confirmado: registrar,
      // liberar el cupo y avisar a Ceci (solo si ese pago es el que confirmó la reserva).
      const upd = (await sql`
        update reservas
           set estado = 'cancelada', mp_estado = ${estado}
         where id = ${reservaId} and estado = 'confirmada' and mp_payment_id = ${String(paymentId)}
         returning nombre, telefono, email, precio_uyu
      `) as any[];
      if (upd.length) {
        await alertarPagoSinTurno({
          motivo:
            estado === 'refunded'
              ? 'Se devolvió el dinero de un turno confirmado. La reserva se canceló y el cupo quedó libre.'
              : 'Hubo un contracargo sobre un turno confirmado. La reserva se canceló y el cupo quedó libre.',
          paymentId: String(paymentId),
          reservaId,
          nombre: upd[0]?.nombre,
          telefono: upd[0]?.telefono,
          email: upd[0]?.email,
          monto: upd[0]?.precio_uyu != null ? Number(upd[0].precio_uyu) : null,
        });
      } else {
        await sql`
          update reservas set mp_payment_id = ${String(paymentId)}, mp_estado = ${estado}
          where id = ${reservaId} and estado = 'pendiente_pago'
        `;
      }
    } else {
      // Rechazado / cancelado: guardamos el estado, no tocamos el cupo (expira solo si no se paga).
      await sql`
        update reservas set mp_payment_id = ${String(paymentId)}, mp_estado = ${estado}
        where id = ${reservaId} and estado = 'pendiente_pago'
      `;
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    // 500 → MercadoPago reintenta la notificación más tarde.
    console.error('MP webhook error:', e instanceof Error ? e.message : e);
    return new Response('error', { status: 500 });
  }
};

/**
 * Pago aprobado de una compra (Club o paquete). Valida monto y moneda contra la
 * base; si no coinciden NO la da por pagada y avisa a Ceci. Idempotente: solo
 * confirma (y manda el mail) la primera vez.
 */
async function confirmarCompra(sql: any, pago: any, paymentId: string, reservaId: string, c: any) {
  const esperado = c.monto_esperado != null ? Number(c.monto_esperado) : null;
  const monedaEsperada: string = c.moneda || 'UYU';
  const pagado = typeof pago.transaction_amount === 'number' ? pago.transaction_amount : null;
  const monedaPagada: string | null = pago.currency_id ?? null;
  const cuotas = Number.isInteger(pago.installments) ? Number(pago.installments) : null;

  if (esperado == null || pagado == null || !mismoMonto(pagado, esperado) || monedaPagada !== monedaEsperada) {
    console.error(
      `MP webhook: compra con monto/moneda distinto (esperado ${esperado} ${monedaEsperada}, pagado ${pagado} ${monedaPagada}) reserva ${reservaId} — no se confirma`
    );
    await sql`
      update reservas set mp_payment_id = ${paymentId}, mp_estado = 'approved_monto_distinto',
             mp_monto = ${pagado}, mp_moneda = ${monedaPagada}, mp_cuotas = ${cuotas}
       where id = ${reservaId}
    `;
    await alertarPagoSinTurno({
      motivo: `Pago de "${c.producto_nombre}" por ${pagado ?? '?'} ${monedaPagada ?? '?'}, pero el precio registrado es ${esperado ?? '?'} ${monedaEsperada}. La compra NO se dio por pagada.`,
      paymentId,
      reservaId,
      nombre: c.nombre,
      telefono: c.telefono,
      email: c.email,
    });
    return;
  }

  const upd = (await sql`
    update reservas
       set estado = 'confirmada', expira_at = null,
           mp_payment_id = ${paymentId}, mp_estado = 'approved',
           mp_monto = ${pagado}, mp_moneda = ${monedaPagada}, mp_cuotas = ${cuotas},
           pagado = true, monto_cobrado = ${pagado}, forma_pago = 'mercadopago',
           pagado_at = now()
     where id = ${reservaId} and estado in ('pendiente_pago', 'expirada')
     returning id
  `) as any[];
  if (!upd.length) return;

  // Paquete pagado → plan con sus sesiones en la ficha (lo agenda desde Mi cuenta
  // cuando Ceci lo habilita, o solo con PLANES_AUTO_DESDE_COMPRA=true).
  await planDesdePaquetePagado(sql, reservaId, 'mercadopago');

  await notificarCompraConfirmada({
    producto: c.producto_nombre ?? c.producto,
    nombre: c.nombre,
    telefono: c.telefono,
    email: c.email,
    monto: formatMonto(pagado, monedaPagada),
    via: 'mercadopago',
    cuotas,
    esPaquete: String(c.producto).startsWith(PAQUETE_ID),
  });
}

// MercadoPago a veces hace un GET de verificación al registrar la URL.
export const GET: APIRoute = async () => new Response('ok', { status: 200 });
