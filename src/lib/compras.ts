/**
 * COMPRAS ONLINE — Club (Regular y Premium) y paquetes de tratamientos
 * ====================================================================
 * Pedido de Sebas (nov-2026): que la web cobre sola el Club y los paquetes, en un
 * pago o en hasta 3 cuotas con Mercado Pago, o por transferencia (Ceci la
 * confirma a mano desde /admin, como la seña).
 *
 * REGLA DE PRECIO (Sebas, nov-2026: "precio de lista y +10 MP"):
 *  - Transferencia: el precio publicado (de lista).
 *  - Mercado Pago: precio publicado + 10%, que cubre la comisión y la
 *    financiación de las cuotas (Ceci absorbe ~7,5%; la paciente no paga
 *    interés aparte). Los textos solo dicen "hasta en 3 cuotas".
 *  - La seña de los turnos NO lleva recargo (a confirmar con Sebas).
 *
 * Todo esto arranca APAGADO: sin PAGO_MEMBRESIAS_ACTIVO la web se comporta como
 * antes (el Club se coordina por WhatsApp y los paquetes no se compran online).
 *
 * El monto lo fija SIEMPRE el servidor desde acá, con los precios vigentes:
 *  - Club: src/data/club.ts (monto + moneda; el Premium es en dólares).
 *  - Paquete de 6: el valor que Ceci carga en /admin → Precios (respaldo: el código).
 *  - Paquete de 12: src/data/tratamientos.ts (todavía no se edita desde el panel).
 * Solo se venden los paquetes que la web muestra con precio (nada "CONFIRMAR").
 *
 * Después de pagar un paquete, Ceci coordina las sesiones por WhatsApp (decisión
 * de Sebas para esta primera versión). Cada sesión NO vuelve a cobrar seña porque
 * no pasa por /reservar: la agenda Ceci.
 */
import { club, esMembresia } from '../data/club';
import { categoriasTratamientos } from '../data/tratamientos';
import { claveTratamiento, type Precios } from './precios-vigentes';

export type Moneda = 'UYU' | 'USD';
export type ViaPago = 'mercadopago' | 'transferencia';

export type Producto = {
  /** 'club' | 'club-premium' | 'paquete6:<tratamiento>' | 'paquete12:<tratamiento>' */
  id: string;
  /**
   * Modalidad con la que se guarda en `reservas.modalidad`. 'sesion' = una sesión
   * de tratamiento con día y hora, pagada completa (no la seña).
   */
  modalidad: 'club' | 'club-premium' | 'paquete' | 'sesion';
  nombre: string;
  /** Precio de lista (lo que se cobra por Mercado Pago). */
  monto: number;
  moneda: Moneda;
  /** Nota corta para el resumen (ej. "alternando ultracavitación y mesoterapia"). */
  nota?: string;
};

/** Modalidad de los paquetes en la base (texto libre, no es un enum). */
export const PAQUETE_ID = 'paquete';

/** Máximo de cuotas que ofrece el checkout (la cuenta de MP permite más; acá se topea). */
export const MAX_CUOTAS = 3;

/** Recargo por pagar con Mercado Pago sobre el precio publicado (src/data/pago.ts → formasDePago). */
export const RECARGO_MERCADOPAGO = 0.1;

/** ¿Está prendido el cobro online del Club y los paquetes? */
export function pagoMembresiasActivo(): boolean {
  const v = String(process.env.PAGO_MEMBRESIAS_ACTIVO ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'on';
}

/** ¿Esta modalidad es una compra (sin fecha) y no un turno? */
export function esCompraModalidad(modalidad: unknown): boolean {
  return typeof modalidad === 'string' && (esMembresia(modalidad) || modalidad === PAQUETE_ID);
}

/** Productos del Club, con su monto y moneda. */
function productosClub(): Producto[] {
  return club.planes.map((p) => ({
    id: p.modalidadId,
    modalidad: p.modalidadId,
    nombre: p.modalidadId === 'club-premium' ? 'Club de las Estaciones Premium' : 'Club de las Estaciones',
    monto: p.monto,
    moneda: p.moneda,
    nota: `Membresía anual · ${p.formato.toLowerCase()}`,
  }));
}

/** Paquetes que se venden online: solo los que tienen precio vigente. */
export function productosPaquete(precios: Precios): Producto[] {
  const out: Producto[] = [];
  for (const cat of categoriasTratamientos) {
    for (const t of cat.tratamientos) {
      const v = precios[claveTratamiento(t.id)];
      // Igual que la web: sin valor por sesión no se muestra ningún paquete.
      if (!v || v.precio == null) continue;
      const nota = t.paqueteNota ? `Sesiones ${t.paqueteNota}` : undefined;
      if (v.paquete6 != null && v.paquete6 > 0) {
        out.push({
          id: `paquete6:${t.id}`,
          modalidad: 'paquete',
          nombre: `Paquete de 6 sesiones: ${t.nombre}`,
          monto: v.paquete6,
          moneda: 'UYU',
          nota,
        });
      }
      if (typeof t.paquete12 === 'number' && t.paquete12 > 0) {
        out.push({
          id: `paquete12:${t.id}`,
          modalidad: 'paquete',
          nombre: `Paquete de 12 sesiones: ${t.nombre}`,
          monto: t.paquete12,
          moneda: 'UYU',
          nota,
        });
      }
    }
  }
  return out;
}

/**
 * Sesión de un tratamiento pagada COMPLETA por Mercado Pago (hasta 3 cuotas),
 * en vez de la seña. Solo tratamientos con valor "por sesión": los que se cobran
 * por zona no tienen un total que la web pueda saber, así que quedan con seña.
 */
export function productoSesion(precios: Precios, tratamientoId: unknown): Producto | null {
  if (typeof tratamientoId !== 'string') return null;
  const t = categoriasTratamientos.flatMap((c) => c.tratamientos).find((x) => x.id === tratamientoId);
  if (!t || t.unidad) return null;
  const v = precios[claveTratamiento(t.id)];
  if (!v || v.precio == null || v.precio <= 0) return null;
  return {
    id: `sesion:${t.id}`,
    modalidad: 'sesion',
    nombre: `Sesión de tratamiento: ${t.nombre}`,
    monto: v.precio,
    moneda: 'UYU',
  };
}

/** ¿Es una sesión pagada completa (turno con fecha) y no una compra sin fecha? */
export const esProductoSesion = (producto: unknown) => typeof producto === 'string' && producto.startsWith('sesion:');

/** Busca un producto por id con los precios vigentes. null si no existe o no se vende. */
export function productoPorId(id: unknown, precios: Precios): Producto | null {
  if (typeof id !== 'string' || !id) return null;
  return [...productosClub(), ...productosPaquete(precios)].find((p) => p.id === id) ?? null;
}

/**
 * Lo que se cobra según el medio: transferencia = precio publicado; Mercado
 * Pago = precio publicado + 10%. Ej.: U$S 200 → U$S 220; $4.800 → $5.280;
 * $24.000 → $26.400. Lo calcula siempre el servidor y el webhook lo valida.
 */
export function montoPorVia(p: Producto, via: ViaPago): number {
  if (via === 'transferencia') return p.monto;
  const conRecargo = p.monto * (1 + RECARGO_MERCADOPAGO);
  // Pesos sin centavos; dólares con hasta 2 decimales.
  return p.moneda === 'UYU' ? Math.round(conRecargo) : Math.round(conRecargo * 100) / 100;
}

/** "$4.800" / "U$S 200" — como se muestra en la web y en el panel. */
export function formatMonto(monto: number, moneda: Moneda | string | null | undefined): string {
  const entero = Number.isInteger(monto);
  const n = entero
    ? String(Math.round(monto)).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    : monto.toFixed(2).replace('.', ',');
  // Espacio duro: que "U$S 200" no se parta en dos renglones en el celular.
  return moneda === 'USD' ? `U$S ${n}` : `$${n}`;
}

/** Compara montos al centavo (MP devuelve números con decimales). */
export function mismoMonto(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}
