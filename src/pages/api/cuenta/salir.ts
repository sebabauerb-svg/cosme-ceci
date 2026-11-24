import type { APIRoute } from 'astro';
import { getSql } from '../../../lib/db';
import { cerrarSesion, PACIENTE_COOKIE } from '../../../lib/cuenta';

export const prerender = false;

/** POST /api/cuenta/salir → cierra la sesión (aunque el perfil esté apagado). */
export const POST: APIRoute = async ({ cookies, redirect }) => {
  try {
    await cerrarSesion(getSql(), cookies);
  } catch {
    cookies.delete(PACIENTE_COOKIE, { path: '/' });
  }
  return redirect('/mi-cuenta', 303);
};
