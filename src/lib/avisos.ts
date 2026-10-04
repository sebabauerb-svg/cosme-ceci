/**
 * Aviso a la paciente de que Ceci le movió el turno: mail + WhatsApp automático
 * (si están activos), y el WhatsApp ya escrito por si hay que mandarlo a mano.
 * Lo usan mover un turno (reserva-mover) y mover un día entero (mover-dia).
 */

import { labelFecha } from './agenda';
import { linkAutogestion, fechaLarga, type TurnoMovido } from './reprogramar';
import { notificarReprogramacion } from './email';
import { enviarWhatsApp } from './whatsapp';
import { generarMensaje, linkWhatsApp } from './mensajes';

export async function avisarTurnoMovido(sql: any, t: TurnoMovido, avisar: boolean) {
  const s = (await sql`select sena_pagada from reservas where id = ${t.id}`) as any[];
  const senaPagada = s[0]?.sena_pagada != null ? Number(s[0].sena_pagada) : null;
  const link = linkAutogestion(t.token);

  if (avisar && t.email) {
    // Se espera (no fire-and-forget): en serverless lo que queda colgado
    // después de responder puede no llegar a salir.
    await notificarReprogramacion(
      {
        modalidad: t.nombreModalidad,
        sede: t.sede,
        fechaLabel: labelFecha(t.fecha),
        hora: t.hora,
        nombre: t.nombre,
        telefono: t.telefono,
        email: t.email,
        sena: senaPagada,
        linkCambio: link,
      },
      { porPaciente: false }
    );
  }

  const wa = avisar
    ? await enviarWhatsApp('movido', t.telefono, {
        nombre: t.nombre,
        servicio: t.nombreModalidad,
        fechaLarga: fechaLarga(t.fecha),
        hora: t.hora,
        sede: t.sede,
        token: t.token,
      })
    : { ok: false };

  const texto = generarMensaje('reprogramado', {
    nombre: t.nombre,
    modalidad: t.nombreModalidad,
    fechaLarga: fechaLarga(t.fecha),
    hora: t.hora,
    sede: t.sede,
    senaPagada,
    linkCambio: link,
  });

  return {
    mailEnviado: avisar && !!t.email,
    waEnviado: wa.ok,
    texto,
    wa: t.telefono && t.telefono !== '—' ? linkWhatsApp(t.telefono, texto) : null,
  };
}
