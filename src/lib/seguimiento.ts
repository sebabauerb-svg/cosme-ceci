/**
 * FICHA DE SEGUIMIENTO
 * ====================
 * Anamnesis, plan de tratamiento, registro por sesión y fotos de cada
 * paciente (pestaña Pacientes del panel). Tablas: ensureSeguimiento en db.ts.
 *
 * Son datos de salud (sensibles, Ley 18.331): /api/admin/seguimiento solo los
 * escribe si la ficha tiene consentimiento_fecha, y todo se sirve únicamente
 * con la sesión del panel.
 *
 * Una "sesión" es la reserva (turno) en la que se atendió: se le agregan qué se
 * hizo, la tolerancia, las indicaciones y la próxima fecha sugerida. Si Ceci
 * registra una sesión sin turno en la agenda, se crea una reserva manual sin
 * hora (como "consulta anterior"), así cuenta igual para el recordatorio.
 */

import { categoriasTratamientos } from '../data/tratamientos';
import {
  ANTECEDENTES, CONDICIONES, ESTADOS_PLAN, ETIQUETAS_FOTO, FOTOTIPOS, HABITOS, OBJETIVOS, TIPOS_PIEL, TOLERANCIAS,
} from '../data/ficha';

export const CATALOGO = new Map(
  categoriasTratamientos.flatMap((c) => c.tratamientos.map((t) => [t.id, t.nombre] as const))
);

/** Tope de espacio para fotos (MB). La base gratis de Neon tiene 0,5 GB en total. */
export const fotosTopeMB = () => {
  const n = Number(process.env.FOTOS_TOPE_MB);
  return Number.isFinite(n) && n > 0 ? n : 300;
};

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const deLista = (v: unknown, lista: readonly string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && lista.includes(x)))] : [];
const unoDe = (v: unknown, lista: readonly string[]) => (typeof v === 'string' && lista.includes(v) ? v : null);
const fechaOk = (f: string) => /^\d{4}-\d{2}-\d{2}$/.test(f);

export type Anamnesis = {
  antecedentes: string[];
  alergias: string;
  medicacion: string;
  fototipo: string | null;
  tipo_piel: string | null;
  condiciones: string[];
  habitos: string[];
  rutina: string;
  otros: string;
};

export function anamnesisValida(b: any): Anamnesis {
  return {
    antecedentes: deLista(b?.antecedentes, ANTECEDENTES),
    alergias: str(b?.alergias, 300),
    medicacion: str(b?.medicacion, 300),
    fototipo: unoDe(b?.fototipo, FOTOTIPOS),
    tipo_piel: unoDe(b?.tipo_piel, TIPOS_PIEL),
    condiciones: deLista(b?.condiciones, CONDICIONES),
    habitos: deLista(b?.habitos, HABITOS),
    rutina: str(b?.rutina, 2000),
    otros: str(b?.otros, 2000),
  };
}

export const objetivosValidos = (v: unknown) => deLista(v, OBJETIVOS);

/** Plan de tratamiento. Devuelve un mensaje de error si algo no cierra. */
export function planValido(b: any): { error: string } | {
  tratamiento_id: string | null; tratamiento: string; sesiones: number | null; frecuencia: string | null;
  inicio: string | null; paquete: string | null; protocolo: string | null; estado: string;
} {
  const tid = str(b?.tratamiento_id, 60);
  const nombre = tid && tid !== 'otro' ? CATALOGO.get(tid) : str(b?.tratamiento, 80);
  if (!nombre) return { error: 'Elegí el tratamiento (o escribí cuál, si es otro).' };
  const ses = b?.sesiones === '' || b?.sesiones == null ? null : Number(b.sesiones);
  if (ses != null && !(Number.isInteger(ses) && ses >= 1 && ses <= 50)) return { error: 'Las sesiones van de 1 a 50.' };
  const inicio = str(b?.inicio, 10);
  if (inicio && !fechaOk(inicio)) return { error: 'La fecha de inicio no es válida.' };
  const estado = typeof b?.estado === 'string' && b.estado in ESTADOS_PLAN ? b.estado : 'en_curso';
  return {
    tratamiento_id: tid && tid !== 'otro' ? tid : null,
    tratamiento: nombre,
    sesiones: ses,
    frecuencia: str(b?.frecuencia, 80) || null,
    inicio: inicio || null,
    paquete: str(b?.paquete, 120) || null,
    protocolo: str(b?.protocolo, 2000) || null,
    estado,
  };
}

export const toleranciaValida = (v: unknown) => unoDe(v, TOLERANCIAS);
export const etiquetaValida = (v: unknown) => unoDe(v, ETIQUETAS_FOTO);
export { fechaOk };

/** Planes de una paciente con cuántas sesiones lleva cada uno. */
export async function planesDe(sql: any, pacienteId: string) {
  return (await sql`
    select p.id, p.tratamiento_id, p.tratamiento, p.sesiones, p.frecuencia, p.inicio::text as inicio,
           p.paquete, p.protocolo, p.estado, p.created_at,
           (select count(*)::int from reservas r where r.plan_id = p.id and r.estado = 'confirmada') as hechas,
           (select max(r.fecha)::text from reservas r where r.plan_id = p.id and r.estado = 'confirmada') as ultima
      from planes p
     where p.paciente_id = ${pacienteId}
     order by (p.estado = 'en_curso') desc, (p.estado = 'pausado') desc, p.created_at desc
  `) as any[];
}

/** Bytes de fotos guardadas en total (para el indicador de espacio). */
export async function fotosBytes(sql: any): Promise<number> {
  const r = (await sql`select coalesce(sum(bytes), 0)::bigint as b from fotos`) as any[];
  return Number(r[0]?.b ?? 0);
}

/** JPEG o WebP por sus primeros bytes (no confiamos en lo que dice el navegador). */
export function tipoImagen(buf: Buffer): string | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
