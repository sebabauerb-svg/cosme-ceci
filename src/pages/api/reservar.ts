import type { APIRoute } from 'astro';
import { getSql, ensureDuracionMin, ensureFranjas, ensureConfirmacion } from '../../lib/db';
import { duracionDeTurno } from '../../lib/agenda';
import { notificarReserva } from '../../lib/email';
import { crearPreferencia, mpConfigurado } from '../../lib/mercadopago';
import { precioOnline } from '../../lib/precios';

export const prerender = false;

const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  club: 'Club de las Estaciones',
};

// Tope de reservas "a confirmar" (sin pago) SIMULTÁNEAS por sede: evita que las
// reservas sin pago tapen la agenda de una sede mientras esperan validación.
const CAP_A_CONFIRMAR: Record<string, number> = { montevideo: 3, 'san-jose': 4, online: 3 };

function labelFecha(iso?: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-UY', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function nombreSede(slug: string | null) {
  if (slug === 'montevideo') return 'Montevideo';
  if (slug === 'san-jose') return 'San José';
  return null;
}

// Rate limit in-memory por IP (mismo criterio que admin/login.ts): cada reserva
// bloquea un cupo por 30 min y dispara emails, así que un loop sin freno puede
// vaciar la agenda y spamear Resend. Por instancia serverless, pero corta el abuso barato.
const intentosPorIp = new Map<string, { count: number; resetAt: number }>();
const RL_VENTANA_MS = 10 * 60 * 1000;
const RL_MAX = 8;
function rateLimitOk(ip: string): boolean {
  const ahora = Date.now();
  const cur = intentosPorIp.get(ip);
  if (!cur || cur.resetAt < ahora) {
    intentosPorIp.set(ip, { count: 1, resetAt: ahora + RL_VENTANA_MS });
    return true;
  }
  cur.count++;
  return cur.count <= RL_MAX;
}

// POST /api/reservar  → crea la reserva (pendiente_pago) y BLOQUEA el cupo.
export const POST: APIRoute = async ({ request, clientAddress }) => {
  let ip = 'desconocida';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || 'desconocida';
  } catch {
    /* clientAddress puede lanzar en build/prerender */
  }
  if (!rateLimitOk(ip)) {
    return json({ ok: false, error: 'Demasiados intentos. Esperá unos minutos y probá de nuevo.' }, 429);
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }

  const { modalidad, sede, fecha, hora, nombre, telefono, email } = body ?? {};
  if (!modalidad || !nombre || !telefono) {
    return json({ ok: false, error: 'Faltan datos obligatorios' }, 400);
  }

  const esMembresia = modalidad === 'club';
  if (!esMembresia && (!fecha || !hora)) {
    return json({ ok: false, error: 'Falta fecha u hora' }, 400);
  }

  // Validación de formato y límites. Neon usa placeholders (no hay SQL injection),
  // pero validamos igual para no guardar datos corruptos ni fechas pasadas.
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const nombreT = str(nombre);
  const telT = str(telefono);
  const emailT = str(email);
  if (!(modalidad in NOMBRE_MODALIDAD)) return json({ ok: false, error: 'Modalidad inválida' }, 400);
  if (nombreT.length < 2 || nombreT.length > 120) return json({ ok: false, error: 'Nombre inválido' }, 400);
  if (telT.length < 5 || telT.length > 40) return json({ ok: false, error: 'Teléfono inválido' }, 400);
  if (emailT && (emailT.length > 160 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailT)))
    return json({ ok: false, error: 'Email inválido' }, 400);
  if (!esMembresia) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return json({ ok: false, error: 'Fecha inválida' }, 400);
    if (!/^\d{2}:\d{2}$/.test(hora)) return json({ ok: false, error: 'Hora inválida' }, 400);
    // Fecha y hora de hoy en Uruguay (UTC-3): no permitimos reservar en el pasado,
    // ni horas de hoy que ya transcurrieron.
    const ahoraUYiso = new Date(Date.now() - 3 * 3600 * 1000).toISOString();
    const hoyUY = ahoraUYiso.slice(0, 10);
    if (fecha < hoyUY) return json({ ok: false, error: 'La fecha ya pasó' }, 400);
    if (fecha === hoyUY && hora <= ahoraUYiso.slice(11, 16))
      return json({ ok: false, error: 'Esa hora ya pasó' }, 400);
  }
  // Una consulta presencial necesita sede real: sin esto, un POST directo caería
  // en el cupo 'online' y bloquearía los horarios de las consultas virtuales.
  if (modalidad === 'presencial' && !nombreSede(str(sede)))
    return json({ ok: false, error: 'Elegí la sede (Montevideo o San José)' }, 400);

  // El monto lo fija el servidor según la modalidad. NUNCA se toma del cliente
  // (el body podría venir manipulado con precio: 1). Ver src/lib/precios.ts.
  const precioNum = precioOnline(modalidad);

  // Camino de reserva: 'pagar' (MercadoPago, hold 30 min) o 'coordinar' (sin pago,
  // queda 'a_confirmar' con hold de 2 h para que Ceci la valide desde el panel).
  const via = body?.via === 'coordinar' ? 'coordinar' : 'pagar';
  const estadoInicial = via === 'coordinar' ? 'a_confirmar' : 'pendiente_pago';
  const holdMin = via === 'coordinar' ? 120 : 30;
  const expira = new Date(Date.now() + holdMin * 60 * 1000).toISOString();
  const capSlug = modalidad === 'presencial' ? str(sede) : 'online';

  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureDuracionMin(sql);
    await ensureConfirmacion(sql);

    // Liberar cupos de reservas vencidas (auto-expiración, sin cron): tanto las de
    // pago (30 min) como las 'a confirmar' sin validar (2 h).
    await sql`
      update reservas set estado = 'expirada'
      where estado in ('pendiente_pago','a_confirmar') and expira_at is not null and expira_at < now()
    `;

    let sedeId: string | null = null;
    const nombreS = nombreSede(sede);
    if (nombreS) {
      const r = await sql`select id from sedes where nombre = ${nombreS} limit 1`;
      sedeId = r[0]?.id ? String(r[0].id) : null;
      if (modalidad === 'presencial' && !sedeId)
        return json({ ok: false, error: 'Elegí la sede (Montevideo o San José)' }, 400);
    }

    // Duración de la consulta: la fija Ceci en su horario semanal. Se copia a la
    // reserva para que el evento de Calendar quede del tamaño correcto.
    // duracionDeTurno también valida que el horario exista y no esté bloqueado:
    // sin esto, un POST directo podría reservar (y pagar) un turno inexistente.
    let duracionMin: number | null = null;
    if (!esMembresia) {
      const sedeKey = sedeId ?? 'online';
      duracionMin = await duracionDeTurno(sql, sedeKey, fecha, hora);
      if (duracionMin == null)
        return json({ ok: false, code: 'SLOT_TOMADO', error: 'Ese horario no está disponible. Elegí otro.' }, 409);
    }

    // Tope de reservas sin resolver por teléfono (pago pendiente + a confirmar):
    // evita que un mismo número acapare cupos sin completar ninguno.
    const pendientes = await sql`
      select count(*)::int as n from reservas
      where telefono = ${telT} and estado in ('pendiente_pago','a_confirmar') and expira_at > now()
    `;
    if ((pendientes[0]?.n ?? 0) >= 3)
      return json({ ok: false, error: 'Ya tenés reservas sin confirmar. Completá el pago (o esperá) y probá de nuevo.' }, 429);

    // Tope de reservas 'a confirmar' SIMULTÁNEAS por sede (solo camino coordinar con
    // cupo): que las reservas sin pago no tapen la agenda entera de una sede.
    if (via === 'coordinar' && !esMembresia) {
      const cap = CAP_A_CONFIRMAR[capSlug] ?? 3;
      const sedeKeyCount = sedeId ?? 'online';
      const enSede = await sql`
        select count(*)::int as n from reservas
        where estado = 'a_confirmar' and (expira_at is null or expira_at > now())
          and coalesce(sede_id::text, 'online') = ${sedeKeyCount}
      `;
      if ((enSede[0]?.n ?? 0) >= cap)
        return json({ ok: false, error: 'Ahora mismo hay varias reservas sin confirmar en esta sede. Podés pagar online para asegurar tu cupo, o probá de nuevo más tarde.' }, 429);
    }

    try {
      const ins = await sql`
        insert into reservas
          (modalidad, sede_id, fecha, hora, nombre, telefono, email, precio_uyu, estado, expira_at, duracion_min)
        values
          (${modalidad}, ${sedeId}, ${esMembresia ? null : fecha}, ${esMembresia ? null : hora},
           ${nombreT}, ${telT}, ${emailT || null}, ${precioNum}, ${estadoInicial}, ${expira}, ${duracionMin})
        returning id
      `;
      const reservaId = String(ins[0].id);

      // Pago online con MercadoPago (solo en el camino 'pagar', si está configurado
      // y hay monto). En 'coordinar' no hay checkout: queda a confirmar por Ceci.
      let initPoint: string | null = null;
      if (via === 'pagar' && mpConfigurado() && precioNum) {
        try {
          // Dominio canónico para back_urls y notification_url: el origin del request
          // puede ser un alias *.vercel.app o un preview (webhook inaccesible) o localhost.
          const origin =
            process.env.PUBLIC_SITE_URL || process.env.SITE_URL || new URL(request.url).origin;
          if (!process.env.PUBLIC_SITE_URL && !process.env.SITE_URL)
            console.warn('MP: PUBLIC_SITE_URL sin configurar, usando origin del request:', origin);
          const tituloItem = [
            NOMBRE_MODALIDAD[modalidad] ?? modalidad,
            nombreS,
            esMembresia ? null : labelFecha(fecha),
            esMembresia ? null : hora ? `${hora} h` : null,
          ]
            .filter(Boolean)
            .join(' · ');
          const pref = await crearPreferencia({
            titulo: tituloItem,
            precio: precioNum,
            reservaId,
            origin,
            email: emailT || null,
            expiraIso: expira,
          });
          initPoint = pref.initPoint;
          await sql`update reservas set mp_preference_id = ${pref.id} where id = ${reservaId}`;
        } catch (e) {
          console.error('MP preferencia:', e instanceof Error ? e.message : e);
        }
      }

      // Aviso por email a Ceci y a la clienta. Fire-and-forget: la latencia de
      // Resend no debe demorar el redirect al checkout (notificarReserva nunca lanza).
      void notificarReserva({
        modalidad: NOMBRE_MODALIDAD[modalidad] ?? modalidad,
        sede: nombreS,
        fechaLabel: esMembresia ? null : labelFecha(fecha),
        hora: esMembresia ? null : hora,
        nombre: nombreT,
        telefono: telT,
        email: emailT || null,
        pagoOnline: !!initPoint,
        via,
      });

      return json({ ok: true, id: reservaId, initPoint, via });
    } catch (e: any) {
      // 23505 = unique_violation → el cupo ya fue tomado entre que eligió y confirmó
      if (e?.code === '23505' || String(e?.message ?? e).includes('reservas_slot_unico')) {
        return json(
          { ok: false, code: 'SLOT_TOMADO', error: 'Ese horario se ocupó recién. Elegí otro.' },
          409
        );
      }
      throw e;
    }
  } catch (e) {
    // Log completo del lado servidor; al cliente solo un mensaje genérico
    // (no exponemos detalles de la base de datos ni del stack).
    console.error('POST /api/reservar:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No pudimos registrar la reserva. Probá de nuevo.' }, 500);
  }
};
