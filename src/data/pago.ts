/**
 * DATOS DE COBRO
 * ==============
 * La web cobra una SEÑA para reservar el turno; el saldo se abona en la consulta.
 * Hay dos caminos: MercadoPago (confirma solo) o transferencia bancaria (Ceci
 * confirma a mano desde /admin cuando ve el pago).
 *
 * ⚠️ COMPLETAR con los datos reales de la cuenta de Ceci (están en su planilla).
 *    Mientras `transferencia.cuenta` esté vacío, la web NO muestra el bloque de
 *    datos bancarios: le dice a la paciente que Ceci se los pasa por WhatsApp.
 *    El resto del flujo (reserva, hold del cupo, confirmación) funciona igual.
 *
 * El monto de la seña vive en `src/lib/precios.ts` (SENA_UYU): es la fuente de
 * verdad server-side y no debe duplicarse acá.
 */

export const transferencia = {
  /** Banco donde está la cuenta. Ej: 'Banco República (BROU)' */
  banco: '',
  /** Titular de la cuenta, como figura en el banco. */
  titular: '',
  /** Número de cuenta (con sucursal si corresponde). */
  cuenta: '',
  /** Tipo/moneda de la cuenta. Ej: 'Caja de ahorro en pesos' */
  tipo: '',
  /** Cédula del titular, si el banco la pide para transferir. Opcional. */
  ci: '',
};

/** ¿Hay datos bancarios cargados como para mostrarlos en la web? */
export function hayDatosTransferencia(): boolean {
  return Boolean(transferencia.banco && transferencia.cuenta);
}

/** Filas a mostrar (solo las cargadas), listas para render. */
export function filasTransferencia(): Array<{ label: string; valor: string }> {
  return [
    { label: 'Banco', valor: transferencia.banco },
    { label: 'Titular', valor: transferencia.titular },
    { label: 'Cuenta', valor: transferencia.cuenta },
    { label: 'Tipo', valor: transferencia.tipo },
    { label: 'Cédula', valor: transferencia.ci },
  ].filter((f) => f.valor);
}
