/**
 * PERFIL DE PACIENTE ("Mi cuenta")
 * ================================
 * La paciente entra con un link mágico que le llega por email (sin
 * contraseña). Su cuenta es su ficha de `pacientes`, encontrada por el email:
 * la web no crea cuentas sola. Ve sus turnos, las indicaciones para casa que
 * Ceci le dejó y su plan, y completa "Mi registro" (cómo siente la piel, qué
 * productos usa), que Ceci ve en la ficha del panel.
 *
 * NO ve lo clínico interno de Ceci: anamnesis, qué se hizo y con qué
 * parámetros, tolerancia, nota de evolución, protocolo ni fotos.
 *
 * Todo está apagado hasta PERFIL_PACIENTES_ACTIVO=true (páginas y APIs dan 404
 * y no sale ningún mail). Tablas: ensurePerfil en db.ts.
 */

import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';
import { normEmail, hoyUY } from './pacientes';
import { NOMBRE_MODALIDAD } from './reprogramar';
import { HABITOS, MAX_PRODUCTOS, MOMENTOS, OBJETIVOS, PASOS, SENSACIONES } from '../data/registro';

export const perfilActivo = () => process.env.PERFIL_PACIENTES_ACTIVO === 'true';

export const PACIENTE_COOKIE = 'cg_paciente';
export const ACCESO_MIN = 20;          // el link que pide ella vence a los 20 minutos
export const INVITACION_MIN = 72 * 60; // el que le manda Ceci para el registro, a los 3 días
export const SESION_DIAS = 30;         // después queda conectada 30 días

/**
 * Solo para probar en un preview: con PERFIL_LINK_EN_PANTALLA=true, fuera de
 * producción y solo para direcciones de prueba de Resend (@resend.dev), el
 * link se muestra en pantalla en vez de tener que abrir el mail. Con un email
 * real nunca: así nadie entra a la ficha de otra persona desde un preview.
 */
export const linkEnPantalla = (email: string) =>
  process.env.PERFIL_LINK_EN_PANTALLA === 'true' &&
  process.env.VERCEL_ENV !== 'production' &&
  email.endsWith('@resend.dev');

const hash = (t: string) => crypto.createHash('sha256').update(t).digest('hex');
const nuevoToken = () => crypto.randomBytes(32).toString('base64url');
export const tokenFormaOk = (t: unknown): t is string => typeof t === 'string' && /^[A-Za-z0-9_-]{43}$/.test(t);

export type Paciente = {
  id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  registro_consentimiento_at: string | null;
};

/** Ficha con ese email. Si hubiera duplicadas, la más reciente. */
export async function pacientePorEmail(sql: any, email: unknown): Promise<{ id: string; nombre: string; email: string } | null> {
  const e = normEmail(email);
  if (!e) return null;
  const rows = (await sql`
    select id, nombre, email from pacientes where email_norm = ${e}
     order by updated_at desc limit 1
  `) as any[];
  return rows[0] ?? null;
}

export const DESTINOS = ['turnos', 'registro', 'recomendaciones'] as const;
export const rutaDestino = (d: string | null | undefined) =>
  d === 'registro' ? '/mi-cuenta/registro' : d === 'recomendaciones' ? '/mi-cuenta/recomendaciones' : '/mi-cuenta';

/** Crea un link mágico de un solo uso. Devuelve el token (va solo en el mail). */
export async function crearAcceso(sql: any, pacienteId: string, destino: string | null = null, minutos = ACCESO_MIN): Promise<string> {
  const token = nuevoToken();
  const d = destino && (DESTINOS as readonly string[]).includes(destino) ? destino : null;
  await sql`
    insert into pacientes_accesos (paciente_id, token_hash, destino, expira_at)
    values (${pacienteId}, ${hash(token)}, ${d}, now() + make_interval(mins => ${minutos}))
  `;
  // Limpieza de vencidos de paso (no hace falta un cron).
  await sql`delete from pacientes_accesos where expira_at < now() - interval '7 days'`;
  return token;
}

export const linkAcceso = (base: string, token: string) => `${base}/mi-cuenta/entrar?t=${encodeURIComponent(token)}`;

/** Canjea el link (una sola vez, dentro del plazo). */
export async function canjearAcceso(sql: any, token: string): Promise<{ pacienteId: string; destino: string | null } | null> {
  const rows = (await sql`
    update pacientes_accesos set usado_at = now()
     where token_hash = ${hash(token)} and usado_at is null and expira_at > now()
    returning paciente_id, destino
  `) as any[];
  return rows[0] ? { pacienteId: rows[0].paciente_id, destino: rows[0].destino } : null;
}

export async function crearSesion(sql: any, cookies: AstroCookies, pacienteId: string) {
  const token = nuevoToken();
  await sql`
    insert into pacientes_sesiones (paciente_id, token_hash, expira_at)
    values (${pacienteId}, ${hash(token)}, now() + make_interval(days => ${SESION_DIAS}))
  `;
  await sql`delete from pacientes_sesiones where expira_at < now()`;
  cookies.set(PACIENTE_COOKIE, token, {
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: 'lax', // lax: llega desde el link del mail
    path: '/',
    maxAge: SESION_DIAS * 24 * 3600,
  });
}

/** La paciente conectada, o null. */
export async function pacienteActual(sql: any, cookies: AstroCookies): Promise<Paciente | null> {
  const t = cookies.get(PACIENTE_COOKIE)?.value;
  if (!tokenFormaOk(t)) return null;
  const rows = (await sql`
    select p.id, p.nombre, p.email, p.telefono, p.registro_consentimiento_at::text as registro_consentimiento_at
      from pacientes_sesiones s join pacientes p on p.id = s.paciente_id
     where s.token_hash = ${hash(t)} and s.expira_at > now()
  `) as any[];
  return rows[0] ?? null;
}

export async function cerrarSesion(sql: any, cookies: AstroCookies) {
  const t = cookies.get(PACIENTE_COOKIE)?.value;
  if (tokenFormaOk(t)) await sql`delete from pacientes_sesiones where token_hash = ${hash(t)}`;
  cookies.delete(PACIENTE_COOKIE, { path: '/' });
}

// ---------- Lo que ve la paciente ----------

/** Sus turnos (sin los vencidos ni rechazados que nunca existieron para ella). */
export async function turnosDe(sql: any, pacienteId: string) {
  return (await sql`
    select r.id, r.estado::text as estado, r.modalidad, coalesce(s.nombre, '') as sede,
           r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora, r.token_gestion,
           r.tratamientos, r.notas
      from reservas r left join sedes s on s.id = r.sede_id
     where r.paciente_id = ${pacienteId}
       and r.estado in ('confirmada', 'a_confirmar', 'pendiente_pago')
       and r.fecha is not null
     order by r.fecha desc, r.hora desc nulls last
     limit 100
  `) as any[];
}

/**
 * Recomendaciones: SOLO las indicaciones para casa de cada consulta (el panel
 * avisa que las ve la paciente) y los planes en curso con su avance. Nada de
 * hizo, tolerancia, evolución, protocolo ni anamnesis.
 */
export async function recomendacionesDe(sql: any, pacienteId: string) {
  const indicaciones = (await sql`
    select r.fecha::text as fecha, r.modalidad, r.tratamientos, r.indicaciones,
           r.proxima_fecha::text as proxima_fecha
      from reservas r
     where r.paciente_id = ${pacienteId} and r.estado = 'confirmada'
       and coalesce(btrim(r.indicaciones), '') <> ''
     order by r.fecha desc nulls last
     limit 50
  `) as any[];
  const planes = (await sql`
    select pl.tratamiento, pl.sesiones, pl.frecuencia, pl.estado,
           (select count(*)::int from reservas r where r.plan_id = pl.id and r.estado = 'confirmada') as hechas,
           (select max(r.proxima_fecha)::text from reservas r where r.plan_id = pl.id and r.estado = 'confirmada') as proxima_fecha
      from planes pl
     where pl.paciente_id = ${pacienteId} and pl.estado in ('en_curso', 'pausado')
     order by pl.created_at desc
  `) as any[];
  return { indicaciones, planes };
}

export async function registrosDe(sql: any, pacienteId: string) {
  return (await sql`
    select id, fecha::text as fecha, nota, sensaciones, sensaciones_texto, objetivos, objetivos_texto,
           productos, cambios, habitos, created_at
      from registros_piel where paciente_id = ${pacienteId}
     order by fecha desc, created_at desc
     limit 100
  `) as any[];
}

// ---------- Validación de "Mi registro" ----------

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const deLista = (v: unknown, lista: readonly string[]) =>
  Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && lista.includes(x)))] : [];
const unoDe = (v: unknown, lista: readonly string[]) => (typeof v === 'string' && lista.includes(v) ? v : null);

export type Producto = { momento: string | null; paso: string | null; producto: string };

export function registroValido(b: any) {
  const n = Number(b?.nota);
  const productos: Producto[] = (Array.isArray(b?.productos) ? b.productos : [])
    .map((p: any) => ({ momento: unoDe(p?.momento, MOMENTOS), paso: unoDe(p?.paso, PASOS), producto: str(p?.producto, 160) }))
    .filter((p: Producto) => p.producto)
    .slice(0, MAX_PRODUCTOS);
  const r = {
    fecha: hoyUY(),
    nota: Number.isInteger(n) && n >= 1 && n <= 5 ? n : null,
    sensaciones: deLista(b?.sensaciones, SENSACIONES),
    sensaciones_texto: str(b?.sensaciones_texto, 2000),
    objetivos: deLista(b?.objetivos, OBJETIVOS),
    objetivos_texto: str(b?.objetivos_texto, 2000),
    productos,
    cambios: str(b?.cambios, 2000),
    habitos: deLista(b?.habitos, HABITOS),
  };
  const vacio = !r.nota && !r.sensaciones.length && !r.sensaciones_texto && !r.objetivos.length &&
    !r.objetivos_texto && !r.productos.length && !r.cambios && !r.habitos.length;
  return vacio ? null : r;
}

/** Nombre de la consulta para mostrarle a la paciente. */
export function nombreConsulta(r: { modalidad?: string | null; tratamientos?: any; notas?: string | null }) {
  const t = Array.isArray(r.tratamientos) && r.tratamientos[0]?.nombre;
  if (t) return String(t);
  if (!r.modalidad || r.modalidad === 'manual') return 'Consulta';
  return NOMBRE_MODALIDAD[r.modalidad] ?? 'Consulta';
}
