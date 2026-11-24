/**
 * COMPRAS ONLINE — Club (Regular y Premium) y paquetes de tratamientos
 * ====================================================================
 * Pedido de Sebas (nov-2026): que la web cobre sola el Club y los paquetes, en un
 * pago o en hasta 3 cuotas con Mercado Pago, o por transferencia con 10% de
 * descuento (Ceci la confirma a mano desde /admin, como la seña).
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
  /** Modalidad con la que se guarda en `reservas.modalidad`. */
  modalidad: 'club' | 'club-premium' | 'paquete';
  nombre: string;
  /** Precio de lista (lo que se cobra por Mercado Pago). */
  monto: number;
  moneda: Moneda;
  /** Nota corta para el resumen (ej. "alternando ultracavitación y mesoterapia"). */
  nota?: string;
};

/** Modalidad de los paquetes en la base (texto libre, no es un enum). */
export const PAQUETE_ID = 'paquete';

/** Máximo de cuotas que ofrece el checkout. Si son con o sin interés lo define Ceci en su cuenta. */
export const MAX_CUOTAS = 3;

/** Descuento por pagar con transferencia (src/data/pago.ts → formasDePago). */
export const DESCUENTO_TRANSFERENCIA = 0.1;

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

/** Busca un producto por id con los precios vigentes. null si no existe o no se vende. */
export function productoPorId(id: unknown, precios: Precios): Producto | null {
  if (typeof id !== 'string' || !id) return null;
  return [...productosClub(), ...productosPaquete(precios)].find((p) => p.id === id) ?? null;
}

/** Lo que se cobra según el medio: Mercado Pago = lista; transferencia = lista − 10%. */
export function montoPorVia(p: Producto, via: ViaPago): number {
  if (via === 'mercadopago') return p.monto;
  const conDescuento = p.monto * (1 - DESCUENTO_TRANSFERENCIA);
  // Pesos sin centavos; dólares con hasta 2 decimales.
  return p.moneda === 'UYU' ? Math.round(conDescuento) : Math.round(conDescuento * 100) / 100;
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
