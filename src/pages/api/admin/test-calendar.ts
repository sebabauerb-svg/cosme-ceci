import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin';
import { crearEventoReserva, calendarConfigurado } from '../../../lib/calendar';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// GET /api/admin/test-calendar  → crea un evento de prueba mañana 10:00 para validar la conexión.
// Ante un error, informa el email de la cuenta de servicio y el calendar id (no
// son secretos) para saber qué compartir y en qué calendario.
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);

  const cuentaServicio = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '(sin definir)';
  const calendarId = process.env.GOOGLE_CALENDAR_ID || '(sin definir)';
  const info = {
    cuenta_de_servicio_a_compartir: cuentaServicio,
    calendar_id_objetivo: calendarId,
  };

  if (!calendarConfigurado()) {
    return json({ ok: false, error: 'Faltan variables de Google Calendar en Vercel.', ...info });
  }
  const fecha = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
  const r = await crearEventoReserva({
    resumen: 'PRUEBA — Conexión de la web',
    descripcion: 'Evento de prueba para validar que la web puede crear turnos en tu calendario. Podés borrarlo.',
    fecha,
    hora: '10:00',
    duracionMin: 30,
  });
  return json(
    r.ok
      ? { ok: true, mensaje: `Evento de prueba creado para ${fecha} 10:00. Revisá el calendario de Ceci.`, ...info }
      : {
          ok: false,
          error: r.error,
          ...info,
          pista:
            'Un 404 casi siempre = el calendar_id_objetivo no existe o la cuenta_de_servicio no tiene acceso. En Google Calendar de Ceci, compartí ese calendario con la cuenta de servicio (permiso "Hacer cambios en los eventos") y confirmá que el calendar id coincida.',
        }
  );
};
