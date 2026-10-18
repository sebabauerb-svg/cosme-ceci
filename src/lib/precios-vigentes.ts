/**
 * PRECIOS VIGENTES — lo que Ceci carga en /admin → Precios, con respaldo al código.
 * ===============================================================================
 * Fuente de verdad: tabla `precios` (Neon). Cada ítem que Ceci no tocó desde el
 * panel, o todos si la base no responde, usa el valor del código:
 *   - tratamientos → src/data/tratamientos.ts
 *   - modalidades  → PRECIOS_UYU en src/lib/precios.ts
 *
 * Solo corre en el servidor (páginas SSR y endpoints). La SEÑA que se cobra por
 * la web no sale de acá: sigue fija en src/lib/precios.ts (SENA_UYU).
 */
import { categoriasTratamientos, CONFIRMAR, formatUYU } from '../data/tratamientos';
import { modalidades } from '../data/modalidades';
import { PRECIOS_UYU } from './precios';
import { getSql } from './db';

export type ValorPrecio = {
  /** Valor por sesión en UYU; null = "Valor en consulta". */
  precio: number | null;
  /** Paquete de 6 sesiones; null = no se muestra. */
  paquete6: number | null;
  /** Sin valor en el código ni en la base: falta que Ceci lo cargue. */
  pendiente: boolean;
};

export type ItemPrecio = ValorPrecio & {
  clave: string;
  nombre: string;
  grupo: string;
  unidad?: string;
  /** Las modalidades no tienen paquete. */
  conPaquete: boolean;
};

export type Precios = Record<string, ValorPrecio>;

export const claveTratamiento = (id: string) => `trat:${id}`;
export const claveModalidad = (id: string) => `mod:${id}`;

/** El catálogo con los valores del código (iniciales / respaldo). */
export function itemsBase(): ItemPrecio[] {
  const items: ItemPrecio[] = [];
  for (const m of modalidades) {
    // El Club se cobra en cuotas y tiene su propio plan (src/data/club.ts).
    if (!(m.id in PRECIOS_UYU) || PRECIOS_UYU[m.id] == null) continue;
    items.push({
      clave: claveModalidad(m.id),
      nombre: m.nombre,
      grupo: 'Consultas',
      precio: PRECIOS_UYU[m.id],
      paquete6: null,
      pendiente: false,
      conPaquete: false,
    });
  }
  for (const cat of categoriasTratamientos) {
    for (const t of cat.tratamientos) {
      items.push({
        clave: claveTratamiento(t.id),
        nombre: t.nombre,
        grupo: `${cat.grupo} · ${cat.titulo}`,
        unidad: t.unidad,
        precio: t.precio === CONFIRMAR ? null : t.precio,
        paquete6: typeof t.paquete6 === 'number' ? t.paquete6 : null,
        pendiente: t.precio === CONFIRMAR,
        conPaquete: true,
      });
    }
  }
  return items;
}

/** Claves válidas (el endpoint del panel rechaza cualquier otra). */
export function clavesValidas(): Set<string> {
  return new Set(itemsBase().map((i) => i.clave));
}

function conTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`timeout ${ms} ms`)), ms)),
  ]);
}

// Caché corta en memoria de la función: la home se sirve desde la CDN, pero si
// varias visitas llegan al servidor a la vez, se consulta la base una sola vez.
let cache: { at: number; data: Precios } | null = null;
const CACHE_MS = 30_000;

export function invalidarPrecios() {
  cache = null;
}

/**
 * Precios vigentes por clave. Nunca lanza: ante cualquier error de base
 * (sin variable, tabla inexistente, timeout) devuelve los valores del código.
 */
export async function leerPrecios(opts: { fresco?: boolean } = {}): Promise<Precios> {
  if (!opts.fresco && cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  const out: Precios = {};
  for (const i of itemsBase()) out[i.clave] = { precio: i.precio, paquete6: i.paquete6, pendiente: i.pendiente };

  try {
    const sql = getSql();
    const filas = (await conTimeout(
      sql`select clave, precio, paquete6 from precios` as Promise<any[]>,
      2500
    )) as any[];
    for (const f of filas) {
      if (!(f.clave in out)) continue; // ítem que ya no existe en el catálogo
      out[f.clave] = {
        precio: f.precio == null ? null : Number(f.precio),
        paquete6: f.paquete6 == null ? null : Number(f.paquete6),
        pendiente: false,
      };
    }
  } catch (e) {
    // La tabla todavía no existe hasta que Ceci guarda por primera vez: es normal.
    const msg = e instanceof Error ? e.message : String(e);
    if (!/relation "precios" does not exist/.test(msg)) {
      console.warn('[precios] usando valores del código:', msg);
    }
  }

  cache = { at: Date.now(), data: out };
  return out;
}

/** Catálogo completo con los valores vigentes (para el panel). */
export async function itemsVigentes(): Promise<ItemPrecio[]> {
  const p = await leerPrecios({ fresco: true });
  return itemsBase().map((i) => ({ ...i, ...p[i.clave] }));
}

/**
 * Precio total vigente de una modalidad (sincrónico, sobre `leerPrecios()`) (para calcular saldos en el panel, los
 * mensajes y los recordatorios). null si no tiene precio publicado.
 */
export function precioModalidad(p: Precios, modalidad: unknown): number | null {
  if (typeof modalidad !== 'string') return null;
  const v = p[claveModalidad(modalidad)];
  return v ? v.precio : (PRECIOS_UYU[modalidad] ?? null);
}

/**
 * Menor valor de sesión de una categoría, solo si TODOS sus tratamientos tienen
 * valor (si falta alguno, el "desde" podría ser falso, así que no se muestra).
 */
export function precioDesde(ids: string[], p: Precios): number | null {
  const valores = ids.map((id) => p[claveTratamiento(id)]?.precio ?? null);
  if (!valores.length || valores.some((v) => v == null)) return null;
  return Math.min(...(valores as number[]));
}

/**
 * Precio de una modalidad formateado para mostrar ("$1.800"). undefined si Ceci
 * la puso en "Valor en consulta". Las que no se editan desde el panel (el Club)
 * siguen mostrando el texto de src/data/modalidades.ts.
 */
export function precioModalidadTexto(p: Precios, m: { id: string; precio?: string }): string | undefined {
  const v = p[claveModalidad(m.id)];
  if (!v) return m.precio;
  return v.precio == null ? undefined : formatUYU(v.precio);
}
