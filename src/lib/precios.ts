/**
 * PRECIOS OFICIALES — fuente de verdad server-side (en pesos uruguayos, UYU).
 * ==========================================================================
 * El monto a cobrar SIEMPRE se resuelve acá, en el servidor. Nunca se confía
 * en el `precio` que manda el navegador: un cliente podría falsificarlo y pagar
 * $1. Mantener en sync con los precios visibles de `src/data/modalidades.ts`.
 */

export const PRECIOS_UYU: Record<string, number | null> = {
  presencial: 1800,
  // ⚠️ TEMPORAL — prueba de pago end-to-end a $1. VOLVER A 1500 después de validar.
  virtual: 1,
  'skincare-inteligente': 1600,
  // El Club es una membresía anual en cuotas estacionales (4 × $1.200): no se
  // cobra como pago único por Checkout Pro. Se coordina y cobra aparte → sin
  // pago online automático (cae al flujo de coordinación manual).
  club: null,
};

/** Monto a cobrar online por una modalidad, o null si esa modalidad no se cobra online. */
export function precioOnline(modalidad: unknown): number | null {
  if (typeof modalidad !== 'string') return null;
  return PRECIOS_UYU[modalidad] ?? null;
}
