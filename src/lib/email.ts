/**
 * Envío de emails vía Resend (https://resend.com).
 * Si no está configurado RESEND_API_KEY, no hace nada (no rompe la reserva).
 * Variables: RESEND_API_KEY, RESEND_FROM (remitente), CECI_NOTIF_EMAIL (a dónde le llega a Ceci).
 */

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
    d.sede ? `<strong>Sede:</strong> ${esc(d.sede)}` : '',
    d.fechaLabel ? `<strong>Cuándo:</strong> ${esc(d.fechaLabel)}${d.hora ? ' · ' + esc(d.hora) + ' h' : ''}` : '',
    `<strong>A nombre de:</strong> ${esc(d.nombre)}`,
    `<strong>WhatsApp:</strong> ${esc(d.telefono)}`,
  ].filter(Boolean);
  return `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#2a302b">${filas.map((f) => `<p style="margin:4px 0">${f}</p>`).join('')}</div>`;
}

/** Avisa que el pago se acreditó y el turno quedó CONFIRMADO. Nunca lanza error. */
export async function notificarReservaConfirmada(d: Datos) {
  try {
    const ceci = process.env.CECI_NOTIF_EMAIL;
    const detalle = bloqueDetalle(d);
    const tareas: Promise<unknown>[] = [];
    if (ceci) {
      tareas.push(
        enviar(
          ceci,
          `✅ Pago confirmado: ${d.nombre} (${d.modalidad})`,
          `<h2 style="font-family:Georgia,serif;color:#2a302b">Turno confirmado (pago acreditado)</h2>${detalle}<p style="color:#55605a">El cupo quedó reservado.</p>`
        )
      );
    }
    if (d.email) {
      tareas.push(
        enviar(
          d.email,
          '✅ Tu turno quedó confirmado — Cecilia Gutiérrez · Cosmetología Médica',
          `<h2 style="font-family:Georgia,serif;color:#2a302b">¡Turno confirmado!</h2>
           <p style="font-family:system-ui;color:#2a302b">${esc(d.nombre)}, recibimos tu pago y tu turno quedó confirmado:</p>
           ${detalle}
           <p style="font-family:system-ui;color:#55605a">¡Te esperamos! Si necesitás reprogramar, escribinos por WhatsApp.</p>`
        )
      );
    }
    await Promise.allSettled(tareas);
  } catch {
    /* no bloquear por un error de email */
  }
}

/** Notifica a Ceci y (si dejó email) a la clienta. Nunca lanza error. */
export async function notificarReserva(d: Datos) {
  try {
    const ceci = process.env.CECI_NOTIF_EMAIL;
    const detalle = bloqueDetalle(d);
    const tareas: Promise<unknown>[] = [];
    const notaCeci = d.pagoOnline
      ? 'La clienta está pagando por MercadoPago. Si el pago se acredita te llega otro aviso; no hace falta coordinar nada.'
      : 'Coordiná el pago con la clienta para confirmar.';
    const notaClienta = d.pagoOnline
      ? 'Cuando se acredite el pago te llega la confirmación por este medio. Si no llegaste a pagar, escribinos por WhatsApp.'
      : 'Para confirmar el turno, coordiná el pago por WhatsApp. ¡Te esperamos!';
    if (ceci) {
      tareas.push(
        enviar(
          ceci,
          `Nueva reserva: ${d.nombre} (${d.modalidad})`,
          `<h2 style="font-family:Georgia,serif;color:#2a302b">Nueva reserva</h2>${detalle}<p style="color:#55605a">${notaCeci}</p>`
        )
      );
    }
    if (d.email) {
      tareas.push(
        enviar(
          d.email,
          'Tu reserva con Cecilia Gutiérrez · Cosmetología Médica',
          `<h2 style="font-family:Georgia,serif;color:#2a302b">¡Reserva recibida!</h2>
           <p style="font-family:system-ui;color:#2a302b">${esc(d.nombre)}, registramos tu reserva:</p>
           ${detalle}
           <p style="font-family:system-ui;color:#55605a">${notaClienta}</p>`
        )
      );
    }
    await Promise.allSettled(tareas);
  } catch {
    /* no bloquear la reserva por un error de email */
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
