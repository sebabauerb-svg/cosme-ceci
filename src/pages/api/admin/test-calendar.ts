import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/admin';
import { crearEventoReserva, calendarConfigurado } from '../../../lib/calendar';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

// GET /api/admin/test-calendar  → crea un evento de prueba mañana 10:00 para validar la conexión.
export const GET: APIRoute = async ({ cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  if (!calendarConfigurado()) {
    return json({ ok: false, error: 'Faltan variables de Google Calendar en Vercel.' });
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
      ? { ok: true, mensaje: `Evento de prueba creado para ${fecha} 10:00. Revisá el calendario de Ceci.` }
      : { ok: false, error: r.error }
  );
};
