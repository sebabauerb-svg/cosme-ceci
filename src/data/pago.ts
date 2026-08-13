/**
 * DATOS DE COBRO
 * ==============
 * La web cobra una SEÑA para reservar el turno; el saldo se abona en la consulta.
 * Hay dos caminos: MercadoPago (confirma solo) o transferencia bancaria (Ceci
 * confirma a mano desde /admin cuando ve el pago).
 *
 * Los datos salen del mensaje que Ceci le manda hoy a cada paciente: la web
 * automatiza ese mismo mensaje, así que tienen que decir exactamente lo mismo.
 *
 * Si `transferencia.cuentaBrou` queda vacío, la web NO muestra el bloque bancario:
 * le dice a la paciente que Ceci le pasa los datos por WhatsApp. El resto del
 * flujo (reserva, hold del cupo, confirmación) funciona igual.
 *
 * El monto de la seña vive en `src/lib/precios.ts` (SENA_UYU): es la fuente de
 * verdad server-side y no debe duplicarse acá.
 */

export const transferencia = {
  /** Banco donde está la cuenta. */
  banco: 'BROU',
  /** Titular de la cuenta, como figura en el banco. */
  titular: 'Maria Gutierrez',
  /**
   * Es la MISMA cuenta escrita de dos formas: desde el propio BROU se usa con
   * guión, desde otro banco va todo junto. Mostramos las dos para que nadie
   * tenga que preguntar (y para que nadie transfiera a un número mal copiado).
   */
  cuentaBrou: '001217532-00004',
  cuentaOtrosBancos: '00121753200004',
  /** Tipo/moneda de la cuenta. Ej: 'Caja de ahorro en pesos'. Opcional. */
  tipo: '',
  /** Cédula del titular, si el banco la pide para transferir. Opcional. */
  ci: '',
};

/**
 * Concepto que Ceci le pide poner a la transferencia para poder identificarla.
 * La web lo completa con el nombre de quien reserva: "Seña Ana Pérez".
 */
export const CONCEPTO_PREFIJO = 'Seña';

/**
 * Política de cancelación (del mensaje de Ceci). Es una condición del pago, así
 * que se muestra ANTES de pagar, no recién en la confirmación.
 */
export const POLITICA_CANCELACION =
  'Para garantizar una atención organizada y puntual, te recordamos que los cambios o ' +
  'cancelaciones deben realizarse con al menos 24 horas de anticipación. De lo contrario, ' +
  'o en caso de inasistencia, el turno no será reembolsable.';

/** ¿Hay datos bancarios cargados como para mostrarlos en la web? */
export function hayDatosTransferencia(): boolean {
  return Boolean(transferencia.banco && transferencia.cuentaBrou);
}

/** Filas a mostrar (solo las cargadas), listas para render. */
export function filasTransferencia(): Array<{ label: string; valor: string }> {
  return [
    { label: 'Banco', valor: transferencia.banco },
    { label: 'Titular', valor: transferencia.titular },
    { label: 'Cuenta (desde BROU)', valor: transferencia.cuentaBrou },
    { label: 'Desde otros bancos', valor: transferencia.cuentaOtrosBancos },
    { label: 'Tipo', valor: transferencia.tipo },
    { label: 'Cédula', valor: transferencia.ci },
  ].filter((f) => f.valor);
}
