import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';

export const ADMIN_COOKIE = 'cg_admin';
export const SESION_TTL_S = 60 * 60 * 12; // 12 h

/**
 * Clave para firmar la sesión. Se deriva de ADMIN_PASSWORD (o de un
 * ADMIN_SESSION_SECRET dedicado si existe), de modo que rotar la contraseña
 * invalida automáticamente todas las sesiones vigentes.
 */
function claveSesion(): string | null {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASSWORD || null;
}

/** ¿Está configurado el panel? (hay contraseña para autenticar) */
export function adminConfigurado(): boolean {
  return !!process.env.ADMIN_PASSWORD;
}

function timingEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false; // distinta longitud → no coincide
  return crypto.timingSafeEqual(ba, bb);
}

/** Compara la contraseña recibida contra ADMIN_PASSWORD en tiempo constante. */
export function passwordOk(password: unknown): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw || typeof password !== 'string') return false;
  return timingEqual(password, pw);
}

/**
 * Crea un token de sesión firmado con expiración embebida:  `<expMs>.<hmacHex>`.
 * No es un hash estático de la contraseña: caduca solo y no se puede reusar
 * indefinidamente si se filtra.
 */
export function crearTokenSesion(ttlSegundos = SESION_TTL_S): string | null {
  const key = claveSesion();
  if (!key) return null;
  const exp = Date.now() + ttlSegundos * 1000;
  const firma = crypto.createHmac('sha256', key).update(`cg-admin:${exp}`).digest('hex');
  return `${exp}.${firma}`;
}

function tokenValido(token: string | undefined | null): boolean {
  if (!token) return false;
  const key = claveSesion();
  if (!key) return false;
  const i = token.indexOf('.');
  if (i < 0) return false;
  const exp = token.slice(0, i);
  const firma = token.slice(i + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false; // mal formado o expirado
  const esperada = crypto.createHmac('sha256', key).update(`cg-admin:${exp}`).digest('hex');
  return timingEqual(firma, esperada);
}

export function isAdmin(cookies: AstroCookies): boolean {
  return tokenValido(cookies.get(ADMIN_COOKIE)?.value);
}
