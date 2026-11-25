import type { APIRoute } from 'astro';
import { getSql, ensureDuracionMin, ensureFranjas, ensureConfirmacion, ensureNewsletter, ensurePacientes, ensureCompras, ensureGestion } from '../../lib/db';
import { baseUrl, normalizarEmail, pedirSuscripcion } from '../../lib/newsletter';
import { vincularPendientes } from '../../lib/pacientes';
import { duracionDeTurno } from '../../lib/agenda';
import { notificarReserva, notificarCompra } from '../../lib/email';
import { crearPreferencia, mpConfigurado, origenPublico } from '../../lib/mercadopago';
import { requiereSede, SESION_ID } from '../../lib/precios';
import { categoriasTratamientos } from '../../data/tratamientos';
import { esMembresia as esMembresiaClub } from '../../data/club';
import {
  pagoMembresiasActivo,
  productoPorId,
  montoPorVia,
  formatMonto,
  MAX_CUOTAS,
  PAQUETE_ID,
  productoSesion,
  requiereSesionCompleta,
  type Producto,
} from '../../lib/compras';
import { leerPrecios, senaDeReserva } from '../../lib/precios-vigentes';

export const prerender = false;

const NOMBRE_MODALIDAD: Record<string, string> = {
  presencial: 'Consulta Presencial',
  virtual: 'Consulta Virtual',
  'skincare-inteligente': 'Asesoramiento Skincare Inteligente',
  sesion: 'Sesión de tratamiento',
  club: 'Club de las Estaciones',
  'club-premium': 'Club de las Estaciones Premium',
  // Solo con PAGO_MEMBRESIAS_ACTIVO (si no, se rechaza más abajo).
  paquete: 'Paquete de sesiones',
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
  // Tratamiento elegido desde la home (solo para la sesión en sede). Se valida
  // contra el catálogo: un id desconocido se ignora y queda como sesión genérica.
  const tratamientoElegido =
    modalidad === SESION_ID && typeof body?.tratamiento === 'string'
      ? categoriasTratamientos.flatMap((c) => c.tratamientos).find((t) => t.id === body.tratamiento) ?? null
      : null;
  const tratamientoNombre = tratamientoElegido?.nombre ?? null;
  const servicioNombre = tratamientoNombre
    ? `Sesión de tratamiento: ${tratamientoNombre}`
    : NOMBRE_MODALIDAD[modalidad] ?? modalidad;
  // El email es obligatorio: la confirmación del turno (con día y hora) se manda
  // por ese medio, tanto si paga por MercadoPago como si la confirma Ceci.
  if (!modalidad || !nombre || !telefono || !email) {
    return json({ ok: false, error: 'Faltan datos obligatorios' }, 400);
  }

  // Compra online (Club o paquete): solo con el cobro nuevo prendido. Apagado,
  // el Club sigue como siempre (coordinar con Ceci) y los paquetes no existen acá.
  const cobroCompras = pagoMembresiasActivo();
  if (modalidad === PAQUETE_ID && !cobroCompras) return json({ ok: false, error: 'Modalidad inválida' }, 400);
  const esMembresia = esMembresiaClub(modalidad) || modalidad === PAQUETE_ID; // sin fecha ni hora
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
  if (!emailT || emailT.length > 160 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailT))
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
  if (requiereSede(modalidad) && !nombreSede(str(sede)))
    return json({ ok: false, error: 'Elegí la sede (Montevideo o San José)' }, 400);

  // El monto lo fija el servidor según la modalidad. NUNCA se toma del cliente
  // (el body podría venir manipulado con precio: 1). Ver src/lib/precios.ts.
  // Es la SEÑA que reserva el turno, no el total del servicio: el saldo se
  // abona en la consulta. El webhook de MP valida el pago contra este valor.
  // La seña puede ser propia del tratamiento (SENA_POR_TRATAMIENTO_ACTIVA):
  // sale de los precios vigentes de la base, igual que lo que muestra /reservar.
  const precios = await leerPrecios();
  let precioNum = senaDeReserva(precios, modalidad, tratamientoElegido?.id ?? null);

  // Compra del Club o de un paquete: el precio sale de los valores vigentes del
  // servidor (src/lib/compras.ts), nunca del body. Para el Club el producto es
  // la propia modalidad; para un paquete, el id que eligió en Tratamientos.
  let compra: Producto | null = null;
  if (cobroCompras && esMembresia) {
    compra = productoPorId(modalidad === PAQUETE_ID ? body?.producto : modalidad, precios);
    if (!compra || compra.modalidad !== modalidad)
      return json({ ok: false, error: 'Ese paquete no está disponible online. Escribile a Ceci por WhatsApp.' }, 400);
  }
  // Sesión de un tratamiento pagada COMPLETA (hasta 3 cuotas) en vez de la seña.
  // Es un turno normal (fecha, cupo, calendario); solo cambia cuánto se cobra.
  // El webhook la valida como la seña, contra precio_uyu (= el total).
  // Tratamiento de varias sesiones (tiene paquete): no se reserva con seña, se
  // paga al menos la sesión completa (Sebas, 25-nov).
  if (modalidad === SESION_ID && body?.cobro !== 'total' && requiereSesionCompleta(precios, tratamientoElegido?.id))
    return json({ ok: false, error: 'Este tratamiento se reserva pagando la sesión completa.' }, 400);
  if (cobroCompras && modalidad === SESION_ID && body?.cobro === 'total') {
    compra = productoSesion(precios, tratamientoElegido?.id);
    if (!compra) return json({ ok: false, error: 'Esta sesión no se puede pagar completa online. Elegí la seña.' }, 400);
    // Transferencia: precio publicado (Ceci la confirma en el panel). Mercado
    // Pago: precio publicado + 10% (src/lib/compras.ts).
    precioNum = montoPorVia(compra, body?.via === 'coordinar' ? 'transferencia' : 'mercadopago');
  }

  // Camino de reserva: 'pagar' (MercadoPago, hold 30 min) o 'coordinar' (sin pago,
  // queda 'a_confirmar' con hold de 2 h para que Ceci la valide desde el panel).
  const via = body?.via === 'coordinar' ? 'coordinar' : 'pagar';
  const estadoInicial = via === 'coordinar' ? 'a_confirmar' : 'pendiente_pago';
  // Una compra no ocupa cupo: le damos más margen (3 días para transferir, 1 día
  // para terminar el pago) así no desaparece del panel antes de que Ceci la vea.
  const holdMin = compra && esMembresia ? (via === 'coordinar' ? 72 * 60 : 24 * 60) : via === 'coordinar' ? 120 : 30;
  const expira = new Date(Date.now() + holdMin * 60 * 1000).toISOString();
  const capSlug = requiereSede(modalidad) ? str(sede) : 'online';

  try {
    const sql = getSql();
    await ensureFranjas(sql);
    await ensureDuracionMin(sql);
    await ensureConfirmacion(sql);
    if (compra) await ensureCompras(sql);

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
      if (requiereSede(modalidad) && !sedeId)
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

      // Lo que se compró, a qué precio y en qué moneda: el webhook valida el pago
      // contra monto_esperado + moneda (precio_uyu queda null: no es una seña).
      // Excepción: la sesión completa guarda el total también en precio_uyu.
      const viaPago = via === 'coordinar' ? 'transferencia' : 'mercadopago';
      const montoEsperado = compra ? montoPorVia(compra, viaPago) : null;
      if (compra) {
        await ensureGestion(sql);
        await sql`
          update reservas
             set producto = ${compra.id}, producto_nombre = ${compra.nombre}, moneda = ${compra.moneda},
                 precio_lista = ${compra.monto}, monto_esperado = ${montoEsperado}, via_pago = ${viaPago},
                 total_acordado = ${montoEsperado}
           where id = ${reservaId}
        `;
      }

      // El tratamiento elegido queda en las notas de la reserva, que Ceci ve y
      // edita en el panel (Gestión). Nunca traba la reserva.
      if (tratamientoNombre) {
        try {
          await sql`update reservas set notas = ${'Tratamiento elegido en la web: ' + tratamientoNombre} where id = ${reservaId}`;
        } catch (e) {
          console.error('reservar → tratamiento en notas:', e instanceof Error ? e.message : e);
        }
      }

      // Ficha de la paciente: la vincula (o la crea). Nunca traba la reserva.
      try {
        await ensurePacientes(sql);
        await vincularPendientes(sql, reservaId);
      } catch (e) {
        console.error('reservar → ficha:', e instanceof Error ? e.message : e);
      }

      // Pago online con MercadoPago (solo en el camino 'pagar', si está configurado
      // y hay monto). En 'coordinar' no hay checkout: queda a confirmar por Ceci.
      let initPoint: string | null = null;
      if (via === 'pagar' && mpConfigurado() && (precioNum || (compra && montoEsperado))) {
        try {
          // Dominio canónico para back_urls y notification_url: el origin del request
          // puede ser un alias *.vercel.app o un preview (webhook inaccesible) o localhost.
          const origin = origenPublico(request.url);
          if (!process.env.PUBLIC_SITE_URL && !process.env.SITE_URL)
            console.warn('MP: PUBLIC_SITE_URL sin configurar, usando origin del request:', origin);
          // El título es lo que la paciente ve en el checkout y en el resumen de
          // MercadoPago: tiene que decir que es la SEÑA, no el total del servicio.
          const tituloItem =
            'Seña — ' +
            [
              servicioNombre,
              nombreS,
              esMembresia ? null : labelFecha(fecha),
              esMembresia ? null : hora ? `${hora} h` : null,
            ]
              .filter(Boolean)
              .join(' · ');
          const pref = compra?.modalidad === SESION_ID
            ? await crearPreferencia({
                // Sesión completa: turno con cupo (vence con la reserva), hasta 3 cuotas.
                titulo: tituloItem.replace(/^Seña — (Sesión de tratamiento: )?/, 'Sesión completa — '),
                precio: precioNum as number,
                maxCuotas: MAX_CUOTAS,
                reservaId,
                origin,
                email: emailT || null,
                expiraIso: expira,
              })
            : compra
            ? await crearPreferencia({
                // Compra: el total (no una seña), en su moneda y hasta 3 cuotas.
                // Sin vencimiento: no hay cupo que liberar.
                titulo: compra.nombre,
                precio: montoEsperado as number,
                moneda: compra.moneda,
                maxCuotas: MAX_CUOTAS,
                reservaId,
                origin,
                email: emailT || null,
              })
            : await crearPreferencia({
                titulo: tituloItem,
                precio: precioNum as number,
                // La seña va en un solo pago: en cuotas la financiación le
                // cuesta a Ceci y la seña no lleva recargo (Sebas, 25-nov).
                maxCuotas: 1,
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
      if (compra && esMembresia) {
        void notificarCompra(
          {
            producto: compra.nombre,
            nombre: nombreT,
            telefono: telT,
            email: emailT || null,
            monto: formatMonto(montoEsperado as number, compra.moneda),
            via: viaPago,
            concepto: `${compra.modalidad === PAQUETE_ID ? 'Paquete' : 'Club'} ${nombreT}`,
            esPaquete: compra.modalidad === PAQUETE_ID,
          },
          { checkout: !!initPoint }
        );
      } else void notificarReserva({
        modalidad: servicioNombre,
        sede: nombreS,
        fechaLabel: esMembresia ? null : labelFecha(fecha),
        hora: esMembresia ? null : hora,
        nombre: nombreT,
        telefono: telT,
        email: emailT || null,
        pagoOnline: !!initPoint,
        via,
        // La sesión completa no es una seña: el mail no habla de saldo.
        sena: compra ? null : precioNum,
      });

      // Casilla opcional "quiero recibir las novedades" (desmarcada por defecto).
      // Mismo doble opt-in que en /blog: queda pendiente hasta que confirme
      // desde el mail. Un error acá nunca debe trabar la reserva.
      const emailNl = body?.newsletter === true ? normalizarEmail(emailT) : null;
      if (emailNl) {
        try {
          await ensureNewsletter(sql);
          await pedirSuscripcion(sql, emailNl, 'reserva', baseUrl(request));
        } catch (e) {
          console.error('newsletter desde reserva:', e instanceof Error ? e.message : e);
        }
      }

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
