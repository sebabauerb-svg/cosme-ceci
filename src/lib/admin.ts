import crypto from 'node:crypto';
import type { AstroCookies } from 'astro';

export const ADMIN_COOKIE = 'cg_admin';

/** Token derivado de la contraseña (no guardamos la clave en texto en la cookie). */
export function adminToken(): string | null {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return crypto.createHash('sha256').update('cg-admin:' + pw).digest('hex');
}

export function passwordOk(password: unknown): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  return !!pw && typeof password === 'string' && password === pw;
}

export function isAdmin(cookies: AstroCookies): boolean {
  const tok = adminToken();
  if (!tok) return false;
  const c = cookies.get(ADMIN_COOKIE)?.value;
  return !!c && c === tok;
}
