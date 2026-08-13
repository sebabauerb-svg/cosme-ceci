/**
 * GENERADOR DE MENSAJES PARA WHATSAPP
 * ===================================
 * Las plantillas que Ceci usa con cada paciente, armadas con los datos reales de
 * la reserva. Están calcadas del mensaje que escribe hoy a mano: mismo tono
 * (cercano, de "vos"), misma estructura de emojis, misma política.
 *
 * Funciones puras: no tocan la base ni la red. El panel las usa para mostrar el
 * texto listo para copiar y para armar el link de wa.me.
 *
 * Cuidado al editar el copy: nada de prometer resultados ni hablar de curar
 * (ver la skill skincare-legal-guardrails). Estos mensajes son operativos —
 * cuándo, dónde y cuánto — y así deberían quedarse.
 */

import { transferencia, hayDatosTransferencia, CONCEPTO_PREFIJO, POLITICA_CANCELACION } from '../data/pago';
import { sedeConDireccion } from '../data/sedes';

export type PlantillaId = 'confirmacion' | 'transferencia' | 'recordatorio' | 'reprogramar';

export type DatosMensaje = {
  nombre: string;
  modalidad: string;
  /** 'sábado 15 de agosto' — fecha larga, como la escribe Ceci */
  fechaLarga?: string | null;
  hora?: string | null;
  /** nombre de la sede tal como está en la base ('Montevideo' / 'San José') */
  sede?: string | null;
  /** seña que corresponde cobrar */
  sena?: number | null;
  /** seña ya recibida (si la hay) */
  senaPagada?: number | null;
  /** saldo a abonar en la consulta */
  saldo?: number | null;
};

export const PLANTILLAS: Array<{ id: PlantillaId; nombre: string; ayuda: string }> = [
  { id: 'confirmacion', nombre: 'Confirmación de turno', ayuda: 'Cuando ya recibiste la seña y el turno queda firme.' },
  { id: 'transferencia', nombre: 'Datos para transferir', ayuda: 'Para quien escribe por WhatsApp sin pasar por la web.' },
  { id: 'recordatorio', nombre: 'Recordatorio', ayuda: 'Para mandar el día anterior a la consulta.' },
  { id: 'reprogramar', nombre: 'Reprogramar', ayuda: 'Cuando hay que mover el turno y ofrecer alternativas.' },
];

const $ = (n: number) => '$' + n.toLocaleString('es-UY');

/** Solo el primer nombre: en un WhatsApp, "Hola María Fernanda" suena a formulario. */
function primerNombre(nombre: string): string {
  return String(nombre || '').trim().split(/\s+/)[0] || '';
}

/**
 * Qué, cuándo y dónde: el bloque que va igual en casi todas las plantillas.
 * El servicio va en su propia línea y NO dentro de la frase, para no tener que
 * bajarlo a minúscula: "Skincare Inteligente" es nombre de marca.
 */
function bloqueCuando(d: DatosMensaje): string[] {
  const l: string[] = [];
  if (d.modalidad) l.push(`📋 Servicio: ${d.modalidad}`);
  if (d.fechaLarga) l.push(`🗓️ Día: ${d.fechaLarga}`);
  if (d.hora) l.push(`⏰ Hora: ${d.hora}`);
  const lugar = d.sede ? sedeConDireccion(d.sede) : 'Videollamada (te paso el link antes de la consulta)';
  if (lugar) l.push(`📍 Lugar: ${lugar}`);
  return l;
}

function bloqueBanco(nombre: string): string[] {
  if (!hayDatosTransferencia()) return [];
  // Las dos formas del mismo número: desde el propio BROU va con guión, desde
  // otro banco todo junto. Ponerlas las dos evita el ida y vuelta por WhatsApp.
  const l = [`💳 Banco: ${transferencia.banco}`, `🔢 Nº de cuenta: ${transferencia.cuentaBrou}`];
  if (transferencia.cuentaOtrosBancos) l.push(`🔢 Desde otros bancos: ${transferencia.cuentaOtrosBancos}`);
  if (transferencia.titular) l.push(`👤 Titular: ${transferencia.titular}`);
  if (transferencia.ci) l.push(`🪪 Cédula: ${transferencia.ci}`);
  l.push(`📌 Concepto: ${CONCEPTO_PREFIJO} ${nombre}`);
  return l;
}

/** Junta líneas dejando una en blanco donde haya un null (separador de párrafo). */
function armar(lineas: Array<string | null>): string {
  return lineas
    .map((l) => (l === null ? '' : l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function generarMensaje(plantilla: PlantillaId, d: DatosMensaje): string {
  const nom = primerNombre(d.nombre);
  const cuando = bloqueCuando(d);
  const saldo = d.saldo != null && d.saldo > 0 ? d.saldo : null;

  if (plantilla === 'confirmacion') {
    return armar([
      `¡Hola ${nom}! ¿Cómo estás?`,
      'Te confirmo tu turno:',
      null,
      ...cuando,
      null,
      d.senaPagada != null
        ? `Ya me llegó tu seña de ${$(d.senaPagada)}, así que tu lugar en la agenda queda reservado. ✨`
        : 'Tu lugar en la agenda queda reservado. ✨',
      saldo ? `El saldo de ${$(saldo)} lo abonás el día de la consulta.` : null,
      null,
      POLITICA_CANCELACION,
      null,
      '¡Nos vemos! Cualquier duda quedo a las órdenes.',
    ]);
  }

  if (plantilla === 'transferencia') {
    const banco = bloqueBanco(d.nombre);
    return armar([
      `¡Hola ${nom}! ¿Cómo estás?`,
      'Te escribo para coordinar los detalles de tu consulta:',
      null,
      ...cuando,
      null,
      `Para dejar tu turno confirmado y asegurar la disponibilidad del espacio, te pido la seña de ${d.sena != null ? $(d.sena) : 'la seña'}.`,
      banco.length ? null : null,
      ...banco,
      null,
      'Cuando la hagas, mandame el comprobante y te confirmo el lugar en la agenda.',
      null,
      POLITICA_CANCELACION,
      null,
      '¡Quedo a disposición por cualquier duda! ✨',
    ]);
  }

  if (plantilla === 'recordatorio') {
    return armar([
      `¡Hola ${nom}! ¿Cómo estás?`,
      'Te paso un recordatorio de tu consulta:',
      null,
      ...cuando,
      null,
      saldo ? `Te queda un saldo de ${$(saldo)} para abonar en la consulta.` : null,
      'Si necesitás reprogramar, avisame lo antes posible así libero el horario.',
      null,
      '¡Nos vemos! ✨',
    ]);
  }

  // reprogramar
  return armar([
    `¡Hola ${nom}! ¿Cómo estás?`,
    d.fechaLarga
      ? `Necesito mover tu turno del ${d.fechaLarga}${d.hora ? ` a las ${d.hora}` : ''}. Disculpame el cambio.`
      : 'Necesito mover tu turno. Disculpame el cambio.',
    null,
    '¿Alguno de estos horarios te sirve?',
    '• ',
    '• ',
    null,
    'Si preferís, decime qué días te quedan cómodos y lo acomodamos.',
    d.senaPagada != null ? 'Tu seña queda vigente para el nuevo turno.' : null,
    null,
    '¡Gracias por la paciencia! ✨',
  ]);
}

/** Teléfono uruguayo → link de wa.me con el mensaje ya cargado. */
export function linkWhatsApp(telefono: string, mensaje: string): string {
  const num = String(telefono).replace(/\D/g, '').replace(/^(598|0)/, '');
  return `https://wa.me/598${num}?text=${encodeURIComponent(mensaje)}`;
}
