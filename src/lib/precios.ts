/**
 * PRECIOS OFICIALES — fuente de verdad server-side (en pesos uruguayos, UYU).
 * ==========================================================================
 * El monto a cobrar SIEMPRE se resuelve acá, en el servidor. Nunca se confía
 * en el `precio` que manda el navegador: un cliente podría falsificarlo y pagar
 * $1. Mantener en sync con los precios visibles de `src/data/modalidades.ts`.
 *
 * MODELO DE COBRO (definido por Ceci, ago-2026): la web NO cobra el total del
 * servicio. Cobra una SEÑA fija que reserva el turno; el saldo se abona en la
 * consulta. La seña se paga por MercadoPago (turno confirmado al instante) o
 * por transferencia bancaria (Ceci confirma a mano desde el panel).
 */

/** Seña que reserva el turno. Es lo único que se cobra por la web. */
export const SENA_UYU = 700;

/** Precio total del servicio (referencia; el saldo se abona en la consulta). */
export const PRECIOS_UYU: Record<string, number | null> = {
  presencial: 1800,
  virtual: 1500,
  'skincare-inteligente': 1600,
  // El Club es una membresía anual en cuotas estacionales (4 × $1.200): no se
  // cobra como pago único por Checkout Pro. Se coordina y cobra aparte → sin
  // pago online automático (cae al flujo de coordinación manual).
  club: null,
};

/** Precio total de la modalidad, o null si no tiene precio fijo publicado. */
export function precioTotal(modalidad: unknown): number | null {
  if (typeof modalidad !== 'string') return null;
  return PRECIOS_UYU[modalidad] ?? null;
}

/**
 * Monto que se cobra por la web para reservar el turno (la seña), o null si esa
 * modalidad no se cobra online. Es el valor que va al Checkout de MercadoPago y
 * el que se guarda en `reservas.precio_uyu` — el webhook valida contra él, así
 * que ambos lados tienen que salir de esta misma función.
 */
export function senaOnline(modalidad: unknown): number | null {
  if (precioTotal(modalidad) == null) return null;
  return SENA_UYU;
}

/** Saldo que queda para abonar en la consulta, o null si no aplica. */
export function saldoEnConsulta(modalidad: unknown): number | null {
  const total = precioTotal(modalidad);
  if (total == null) return null;
  return Math.max(0, total - SENA_UYU);
}
