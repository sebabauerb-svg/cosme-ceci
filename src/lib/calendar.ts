/**
 * Google Calendar — crea eventos en el calendario de Ceci cuando se confirma un turno.
 * Usa una "cuenta de servicio" de Google (autenticación JWT, sin librerías externas).
 *
 * Variables (Vercel):
 *  - GOOGLE_SERVICE_ACCOUNT_EMAIL : email de la cuenta de servicio (…@….iam.gserviceaccount.com)
 *  - GOOGLE_PRIVATE_KEY           : la private_key del JSON (con \n escapados o reales)
 *  - GOOGLE_CALENDAR_ID           : el calendario de Ceci (su email de Gmail, o el id de un calendario)
 *
 * Si falta alguna, las funciones no hacen nada (no rompen la reserva).
 */

import crypto from 'node:crypto';

const TZ = 'America/Montevideo';
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

function getCreds() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY;
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  if (!email || !rawKey || !calendarId) return null;
  return { email, key: rawKey.replace(/\\n/g, '\n'), calendarId };
}

export function calendarConfigurado(): boolean {
  return !!getCreds();
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function accessToken(email: string, key: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 })
  );
  const input = `${header}.${claims}`;
  const sig = crypto.createSign('RSA-SHA256').update(input).sign(key);
  const jwt = `${input}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);
  return (await res.json()).access_token as string;
}

function sumarMinutos(hora: string, min: number): string {
  const [h, m] = hora.split(':').map(Number);
  const t = h * 60 + m + min;
  return `${String(Math.floor(t / 60) % 24).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/**
 * Crea un evento en el calendario de Ceci. Nunca lanza.
 * Devuelve { ok } para que un endpoint de prueba pueda mostrar el error.
 */
export async function crearEventoReserva(opts: {
  resumen: string;
  descripcion: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  duracionMin: number;
}): Promise<{ ok: boolean; error?: string }> {
  const creds = getCreds();
  if (!creds) return { ok: false, error: 'Google Calendar no está configurado' };
  try {
    const token = await accessToken(creds.email, creds.key);
    const body = {
      summary: opts.resumen,
      description: opts.descripcion,
      start: { dateTime: `${opts.fecha}T${opts.hora}:00`, timeZone: TZ },
      end: { dateTime: `${opts.fecha}T${sumarMinutos(opts.hora, opts.duracionMin)}:00`, timeZone: TZ },
    };
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(creds.calendarId)}/events`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    if (!res.ok) {
      const msg = `Calendar event ${res.status}: ${await res.text()}`;
      console.error('Google Calendar:', msg);
      return { ok: false, error: msg };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Google Calendar:', msg);
    return { ok: false, error: msg };
  }
}
