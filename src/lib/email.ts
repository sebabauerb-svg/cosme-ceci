/**
 * Envío de emails vía Resend (https://resend.com).
 * Si no está configurado RESEND_API_KEY, no hace nada (no rompe la reserva).
 * Variables: RESEND_API_KEY, RESEND_FROM (remitente), CECI_NOTIF_EMAIL (a dónde le llega a Ceci).
 */

import {
  CONCEPTO_PREFIJO,
  POLITICA_CANCELACION,
  filasTransferencia,
  hayDatosTransferencia,
} from '../data/pago';
import { sedeConDireccion } from '../data/sedes';

const FROM_DEFAULT = 'Cecilia Gutiérrez · Cosmetología Médica <onboarding@resend.dev>';

async function enviar(to: string, subject: string, html: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || FROM_DEFAULT,
      to,
      subject,
      html,
    }),
  });
}

type Datos = {
  modalidad: string;
  sede?: string | null;
  fechaLabel?: string | null;
  hora?: string | null;
  nombre: string;
  telefono: string;
  email?: string | null;
  /** true si la clienta fue redirigida al checkout de MercadoPago */
  pagoOnline?: boolean;
  /** camino de reserva: 'coordinar' = sin pago, queda a confirmar por Ceci */
  via?: 'pagar' | 'coordinar';
  /** seña que reserva el turno (lo único que se cobra por la web) */
  sena?: number | null;
};

/** Escapa caracteres HTML: los datos del cliente van dentro del HTML del email. */
const esc = (s: unknown) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string
  );

function bloqueDetalle(d: Datos) {
  const filas = [
    `<strong>Servicio:</strong> ${esc(d.modalidad)}`,
    // Con dirección: el mail tiene que decirle a la paciente adónde ir, igual
    // que el mensaje que Ceci manda a mano.
    d.sede ? `<strong>Dónde:</strong> ${esc(sedeConDireccion(d.sede))}` : '',
    d.fechaLabel ? `<strong>Cuándo:</strong> ${esc(d.fechaLabel)}${d.hora ? ' · ' + esc(d.hora) + ' h' : ''}` : '',
    `<strong>A nombre de:</strong> ${esc(d.nombre)}`,
    `<strong>WhatsApp:</strong> ${esc(d.telefono)}`,
  ].filter(Boolean);
  return `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#2a302b">${filas.map((f) => `<p style="margin:4px 0">${f}</p>`).join('')}</div>`;
}

/**
 * Línea de cobro para la clienta: qué señó y que el resto se abona en la
 * consulta. Sin cifra del saldo a propósito — el valor final puede cambiar
 * (ej. la consulta se bonifica al contratar un protocolo el mismo día).
 * Se omite si no hay seña registrada (ej. el Club, que se coordina aparte).
 */
function bloqueCobro(d: Datos) {
  if (d.sena == null) return '';
  return `<p style="font-family:system-ui,sans-serif;line-height:1.7;color:#2a302b;margin:14px 0 0">
    <strong>Seña abonada:</strong> $${esc(d.sena)} · El saldo lo abonás en la consulta.
  </p>`;
}

/**
 * Avisa que el turno quedó CONFIRMADO. Nunca lanza error.
 * opts.online (default true): pago acreditado por MercadoPago. Si es false, la
 * confirmó Ceci a mano desde el panel (sin pago online), y el copy lo refleja.
 */
export async function notificarReservaConfirmada(d: Datos, opts: { online?: boolean } = {}) {
  try {
    const online = opts.online !== false;
    const ceci = process.env.CECI_NOTIF_EMAIL;
    const detalle = bloqueDetalle(d);
    const tareas: Promise<unknown>[] = [];
    if (ceci) {
      tareas.push(
        enviar(
          ceci,
          online
            ? `✅ Pago confirmado: ${d.nombre} (${d.modalidad})`
            : `✅ Turno confirmado: ${d.nombre} (${d.modalidad})`,
          `<h2 style="font-family:Georgia,serif;color:#2a302b">${online ? 'Turno confirmado (pago acreditado)' : 'Turno confirmado'}</h2>${detalle}<p style="color:#55605a">El cupo quedó reservado.</p>`
        )
      );
    }
    if (d.email) {
      // El día y la hora van en el asunto: es lo que la paciente necesita ver
      // sin abrir el mail, y lo que después busca para no olvidarse del turno.
      const cuando = d.fechaLabel ? `${d.fechaLabel}${d.hora ? ' · ' + d.hora + ' h' : ''}` : null;
      tareas.push(
        enviar(
          d.email,
          cuando
            ? `✅ Turno confirmado: ${cuando} — Cecilia Gutiérrez · Cosmetología Médica`
            : '✅ Tu turno quedó confirmado — Cecilia Gutiérrez · Cosmetología Médica',
          `<h2 style="font-family:Georgia,serif;color:#2a302b">¡Turno confirmado!</h2>
           <p style="font-family:system-ui;color:#2a302b">${esc(d.nombre)}, ${
             online
               ? 'recibimos tu seña por MercadoPago y tu turno quedó confirmado'
               : d.sena != null
                 ? 'confirmamos tu pago y tu turno quedó agendado'
                 : 'confirmamos tu turno'
           }:</p>
           ${detalle}
           ${bloqueCobro(d)}
           <p style="font-family:system-ui;color:#55605a">¡Te esperamos! Si necesitás reprogramar, escribinos por WhatsApp.</p>
           ${bloquePolitica()}`
        )
      );
    }
    await Promise.allSettled(tareas);
  } catch {
    /* no bloquear por un error de email */
  }
}

/**
 * Datos bancarios para señar por transferencia. Vacío si todavía no se cargaron
 * en `src/data/pago.ts` (ahí el copy le dice que Ceci se los pasa por WhatsApp).
 */
function bloqueTransferencia(d: Datos) {
  if (!hayDatosTransferencia()) return '';
  // El concepto lleva el nombre para que Ceci pueda identificar la transferencia.
  const filas = [
    ...filasTransferencia(),
    { label: 'Concepto', valor: `${CONCEPTO_PREFIJO} ${d.nombre}` },
  ]
    .map((f) => `<p style="margin:4px 0"><strong>${esc(f.label)}:</strong> ${esc(f.valor)}</p>`)
    .join('');
  return `<div style="background:#f6f4ef;border-radius:10px;padding:14px 18px;margin:16px 0">
    <p style="font-family:system-ui,sans-serif;font-weight:600;color:#2a302b;margin:0 0 8px">
      Datos para transferir${d.sena != null ? ` la seña de $${esc(d.sena)}` : ''}
    </p>
    <div style="font-family:system-ui,sans-serif;line-height:1.7;color:#2a302b">${filas}</div>
  </div>`;
}

/** Política de cancelación, con el mismo texto que usa la web. */
function bloquePolitica() {
  return `<p style="font-family:system-ui,sans-serif;font-size:13px;line-height:1.6;color:#55605a;margin:18px 0 0;padding-top:14px;border-top:1px solid #e4e0d8">
    ${esc(POLITICA_CANCELACION)}
  </p>`;
}

/** Notifica a Ceci y (si dejó email) a la clienta. Nunca lanza error. */
export async function notificarReserva(d: Datos) {
  try {
    const ceci = process.env.CECI_NOTIF_EMAIL;
    const detalle = bloqueDetalle(d);
    const tareas: Promise<unknown>[] = [];
    const coordinar = d.via === 'coordinar';
    const notaCeci = coordinar
      ? `La clienta reservó para señar por transferencia${d.sena != null ? ` ($${esc(d.sena)})` : ''} y el cupo quedó retenido 2 horas. Cuando veas el pago, confirmala (o rechazala) desde el panel: /admin → “Reservas a confirmar”.`
      : d.pagoOnline
        ? 'La clienta está pagando por MercadoPago. Si el pago se acredita te llega otro aviso; no hace falta coordinar nada.'
        : 'Coordiná el pago con la clienta para confirmar.';
    const montoSena = d.sena != null ? `$${esc(d.sena)}` : 'la seña';
    const notaClienta = coordinar
      ? `Tu turno queda reservado. Para confirmarlo, transferí ${montoSena} de seña y avisale a Ceci por WhatsApp: cuando vea el pago te llega la confirmación con el día y la hora.`
      : d.pagoOnline
        ? 'Cuando se acredite el pago te llega la confirmación por este medio. Si no llegaste a pagar, escribinos por WhatsApp.'
        : 'Para confirmar el turno, coordiná el pago por WhatsApp. ¡Te esperamos!';
    if (ceci) {
      tareas.push(
        enviar(
          ceci,
          coordinar
            ? `⏳ Reserva a confirmar: ${d.nombre} (${d.modalidad})`
            : `Nueva reserva: ${d.nombre} (${d.modalidad})`,
          `<h2 style="font-family:Georgia,serif;color:#2a302b">${coordinar ? 'Reserva a confirmar' : 'Nueva reserva'}</h2>${detalle}<p style="color:#55605a">${notaCeci}</p>`
        )
      );
    }
    if (d.email) {
      tareas.push(
        enviar(
          d.email,
          coordinar
            ? 'Tu reserva quedó pre-reservada — Cecilia Gutiérrez · Cosmetología Médica'
            : 'Tu reserva con Cecilia Gutiérrez · Cosmetología Médica',
          `<h2 style="font-family:Georgia,serif;color:#2a302b">${coordinar ? '¡Reserva recibida! (a confirmar)' : '¡Reserva recibida!'}</h2>
           <p style="font-family:system-ui;color:#2a302b">${esc(d.nombre)}, registramos tu reserva:</p>
           ${detalle}
           ${coordinar ? bloqueTransferencia(d) : ''}
           <p style="font-family:system-ui;color:#55605a">${notaClienta}</p>
           ${bloquePolitica()}`
        )
      );
    }
    await Promise.allSettled(tareas);
  } catch {
    /* no bloquear la reserva por un error de email */
  }
}

/**
 * Recordatorio del turno de mañana, a la paciente. Lo dispara el cron diario.
 * Solo datos operativos (cuándo, dónde, saldo): nada de promesas ni consejos
 * clínicos por mail. Nunca lanza error.
 */
export async function notificarRecordatorio(d: Datos & { saldo?: number | null }) {
  try {
    if (!d.email) return;
    const cuando = d.fechaLabel ? `${d.fechaLabel}${d.hora ? ' · ' + d.hora + ' h' : ''}` : null;
    const saldo =
      d.saldo != null && d.saldo > 0
        ? `<p style="font-family:system-ui;color:#2a302b">Te queda un saldo de <strong>$${esc(d.saldo)}</strong> para abonar en la consulta.</p>`
        : '';
    await enviar(
      d.email,
      cuando ? `⏰ Recordatorio: tu turno es ${cuando}` : '⏰ Recordatorio de tu turno',
      `<h2 style="font-family:Georgia,serif;color:#2a302b">Te esperamos</h2>
       <p style="font-family:system-ui;color:#2a302b">${esc(d.nombre)}, te recordamos tu turno:</p>
       ${bloqueDetalle(d)}
       ${saldo}
       <p style="font-family:system-ui;color:#55605a">Si necesitás reprogramar, escribinos por WhatsApp lo antes posible así liberamos el horario.</p>
       ${bloquePolitica()}`
    );
  } catch {
    /* el cron no debe caerse por un error de email */
  }
}

/**
 * Alerta urgente a Ceci: hay un pago acreditado que NO pudo confirmar el turno
 * (cupo ocupado por otra reserva, o monto distinto). Hay que reembolsar o
 * reacomodar a la clienta a mano. Nunca lanza error.
 */
export async function alertarPagoSinTurno(opts: {
  motivo: string;
  paymentId: string;
  reservaId: string;
  nombre?: string | null;
  telefono?: string | null;
  email?: string | null;
  monto?: number | null;
}) {
  try {
    const ceci = process.env.CECI_NOTIF_EMAIL;
    if (!ceci) return;
    const filas = [
      `<strong>Motivo:</strong> ${esc(opts.motivo)}`,
      `<strong>Pago MercadoPago:</strong> ${esc(opts.paymentId)}`,
      `<strong>Reserva:</strong> ${esc(opts.reservaId)}`,
      opts.nombre ? `<strong>Clienta:</strong> ${esc(opts.nombre)}` : '',
      opts.telefono ? `<strong>WhatsApp:</strong> ${esc(opts.telefono)}` : '',
      opts.email ? `<strong>Email:</strong> ${esc(opts.email)}` : '',
      opts.monto != null ? `<strong>Monto:</strong> $${esc(opts.monto)} UYU` : '',
    ].filter(Boolean);
    await enviar(
      ceci,
      `⚠️ Pago recibido SIN turno confirmado — revisar`,
      `<h2 style="font-family:Georgia,serif;color:#a76a4b">Atención: pago acreditado sin turno</h2>
       <div style="font-family:system-ui,sans-serif;line-height:1.7;color:#2a302b">${filas.map((f) => `<p style="margin:4px 0">${f}</p>`).join('')}</div>
       <p style="font-family:system-ui;color:#55605a">Contactá a la clienta para reprogramar o devolver el dinero desde MercadoPago (Actividad → el pago → Devolver dinero).</p>`
    );
  } catch {
    /* nunca bloquear el webhook por un error de email */
  }
}
