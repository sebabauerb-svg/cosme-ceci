import type { APIRoute } from 'astro';
import { getSql, ensureGoogleEventId } from '../../../lib/db';
import {
  obtenerPago,
  verificarFirmaWebhook,
  webhookSecretConfigurado,
} from '../../../lib/mercadopago';
import { notificarReservaConfirmada, alertarPagoSinTurno } from '../../../lib/email';
import { crearEventoReserva } from '../../../lib/calendar';

export const prerender = false;

const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  club: 'Club de las Estaciones',
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

    if (estado === 'approved') {
      // Integridad de monto: el pago debe coincidir con el precio que registramos
      // server-side. Defensa extra contra manipulación del monto.
      const prev = (await sql`
        select precio_uyu, nombre, telefono, email from reservas where id = ${reservaId}
      `) as any[];
      const precioEsperado = prev[0]?.precio_uyu != null ? Number(prev[0].precio_uyu) : null;
      const montoPagado =
        typeof pago.transaction_amount === 'number' ? Math.round(pago.transaction_amount) : null;
      if (precioEsperado != null && montoPagado != null && montoPagado !== precioEsperado) {
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
      let upd: any[];
      try {
        upd = await sql`
          update reservas
             set estado = 'confirmada', expira_at = null,
                 mp_payment_id = ${String(paymentId)}, mp_estado = ${estado}
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
                 r.nombre, r.telefono, r.email, r.duracion_min
          from reservas r left join sedes s on s.id = r.sede_id
          where r.id = ${reservaId}
        `) as any[];
        const d = r[0];
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
                d.sede ? `Sede: ${d.sede}` : 'Online',
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

// MercadoPago a veces hace un GET de verificación al registrar la URL.
export const GET: APIRoute = async () => new Response('ok', { status: 200 });
