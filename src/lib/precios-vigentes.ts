/**
 * PRECIOS VIGENTES — lo que Ceci carga en /admin → Precios, con respaldo al código.
 * ===============================================================================
 * Fuente de verdad: tabla `precios` (Neon). Cada ítem que Ceci no tocó desde el
 * panel, o todos si la base no responde, usa el valor del código:
 *   - tratamientos → src/data/tratamientos.ts
 *   - modalidades  → PRECIOS_UYU en src/lib/precios.ts
 *
 * Solo corre en el servidor (páginas SSR y endpoints).
 *
 * SEÑA POR TRATAMIENTO (nov-2026, pedido de Sebas): Ceci puede fijar la seña de
 * cada tratamiento (columna `sena`). Vacía = la seña general (SENA_UYU, $700).
 * Solo se COBRA con SENA_POR_TRATAMIENTO_ACTIVA prendida; apagada, todo sigue
 * con $700 aunque haya valores cargados. Ver senaDeReserva().
 */
import { categoriasTratamientos, CONFIRMAR, formatUYU } from '../data/tratamientos';
import { modalidades } from '../data/modalidades';
import { PRECIOS_UYU, SENA_UYU, SESION_ID, senaOnline } from './precios';
import { getSql } from './db';

export type ValorPrecio = {
  /** Valor por sesión en UYU; null = "Valor en consulta". */
  precio: number | null;
  /** Paquete de 6 sesiones; null = no se muestra. */
  paquete6: number | null;
  /** Seña para reservar este tratamiento; null = la general (SENA_UYU). */
  sena: number | null;
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
      sena: null,
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
        sena: null,
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
  for (const i of itemsBase())
    out[i.clave] = { precio: i.precio, paquete6: i.paquete6, sena: i.sena, pendiente: i.pendiente };

  try {
    const sql = getSql();
    let filas: any[];
    try {
      filas = (await conTimeout(
        sql`select clave, precio, paquete6, sena from precios` as Promise<any[]>,
        2500
      )) as any[];
    } catch (e) {
      // Base sin la columna `sena` todavía (se crea al guardar precios desde el
      // panel): leemos lo de siempre, así los precios NO vuelven a los del código.
      if (!/column "sena" does not exist/.test(e instanceof Error ? e.message : String(e))) throw e;
      filas = (await conTimeout(
        sql`select clave, precio, paquete6, null as sena from precios` as Promise<any[]>,
        2500
      )) as any[];
    }
    for (const f of filas) {
      if (!(f.clave in out)) continue; // ítem que ya no existe en el catálogo
      out[f.clave] = {
        precio: f.precio == null ? null : Number(f.precio),
        paquete6: f.paquete6 == null ? null : Number(f.paquete6),
        sena: f.sena == null ? null : Number(f.sena),
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

/** ¿Se cobra la seña que Ceci cargó por tratamiento? (si no, $700 para todo) */
export function senaPorTratamientoActiva(): boolean {
  const v = String(process.env.SENA_POR_TRATAMIENTO_ACTIVA ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'si' || v === 'sí' || v === 'on';
}

/**
 * Seña que se cobra al reservar. Es la fuente única para /reservar (lo que se
 * muestra) y /api/reservar (lo que se guarda en precio_uyu y valida el webhook).
 * Solo la sesión de un tratamiento elegido puede tener seña propia; todo lo
 * demás sigue con senaOnline() (la general, o null si no se cobra online).
 */
export function senaDeReserva(p: Precios, modalidad: unknown, tratamientoId?: string | null): number | null {
  const base = senaOnline(modalidad);
  if (base == null || modalidad !== SESION_ID || !tratamientoId || !senaPorTratamientoActiva()) return base;
  const propia = p[claveTratamiento(tratamientoId)]?.sena;
  return propia != null && propia > 0 ? propia : SENA_UYU;
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
