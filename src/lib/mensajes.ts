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

/** 'miércoles 19 de agosto' → 'Miércoles 19 de agosto' */
function capitalizar(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/**
 * Qué, cuándo y dónde: el bloque que va igual en casi todas las plantillas.
 * Va como lista con viñetas, igual que lo escribe Ceci. El servicio ocupa su
 * propia línea y no entra en la frase: así no hay que bajarlo a minúscula y
 * "Skincare Inteligente" conserva las mayúsculas de marca.
 */
function bloqueCuando(d: DatosMensaje): string[] {
  const l: string[] = [];
  if (d.modalidad) l.push(`* ${d.modalidad}`);
  if (d.fechaLarga) l.push(`* 🗓️ Día: ${capitalizar(d.fechaLarga)}`);
  if (d.hora) l.push(`* ⏰ Hora: ${d.hora} h`);
  const lugar = d.sede ? sedeConDireccion(d.sede) : 'Videollamada (te enviamos el link antes de la consulta)';
  if (lugar) l.push(`* 📍 Lugar: ${lugar}`);
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
  // Nombre tal como está cargado: Ceci puede corregirlo desde el panel, así que
  // no lo recortamos (un "María Cecilia" se perdería quedándonos con la primera
  // palabra). El saludo lleva coma, como lo escribe ella.
  const nom = String(d.nombre || '').trim();
  const cuando = bloqueCuando(d);
  const cierre = '¡Quedamos a disposición por cualquier duda y nos vemos pronto! ✨';

  if (plantilla === 'confirmacion') {
    return armar([
      `¡Hola, ${nom}!`,
      'Te confirmamos los detalles de tu turno agendado a través de la web:',
      null,
      ...cuando,
      null,
      POLITICA_CANCELACION,
      null,
      cierre,
    ]);
  }

  if (plantilla === 'transferencia') {
    return armar([
      `¡Hola, ${nom}!`,
      'Te escribimos para coordinar los detalles de tu consulta:',
      null,
      ...cuando,
      null,
      `Para dejar tu turno formalmente confirmado y asegurar la disponibilidad del espacio, te pedimos el pago de la seña previa de ${d.sena != null ? $(d.sena) : 'la seña'}.`,
      null,
      'Podés realizar la transferencia a los siguientes datos:',
      ...bloqueBanco(d.nombre),
      null,
      'Por favor, envianos el comprobante de pago una vez realizado para confirmar tu lugar en la agenda.',
      null,
      POLITICA_CANCELACION,
      null,
      cierre,
    ]);
  }

  if (plantilla === 'recordatorio') {
    return armar([
      `¡Hola, ${nom}!`,
      'Te recordamos tu turno:',
      null,
      ...cuando,
      null,
      'Si necesitás reprogramar, avisanos lo antes posible así liberamos el horario.',
      null,
      cierre,
    ]);
  }

  // reprogramar
  return armar([
    `¡Hola, ${nom}!`,
    d.fechaLarga
      ? `Necesitamos mover tu turno del ${capitalizar(d.fechaLarga)}${d.hora ? ` a las ${d.hora} h` : ''}. Disculpanos el cambio.`
      : 'Necesitamos mover tu turno. Disculpanos el cambio.',
    null,
    '¿Alguno de estos horarios te sirve?',
    '* ',
    '* ',
    null,
    'Si preferís, decinos qué días te quedan cómodos y lo acomodamos.',
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
