/**
 * SESIONES DE UN PLAN QUE AGENDA LA PACIENTE
 * ==========================================
 * Un plan (tabla `planes`, de la ficha de seguimiento) con N sesiones, ya
 * contratado y pago, deja que la paciente agende sola sus sesiones desde Mi
 * cuenta: el turno queda confirmado, con su plan_id y sin cobrar seña de nuevo.
 *
 * Reglas:
 *  - Solo planes en curso, con cantidad de sesiones y HABILITADOS
 *    (habilitado_at). Los habilita Ceci desde la ficha, o una compra online
 *    pagada (#26) si PLANES_AUTO_DESDE_COMPRA=true. Así nadie agenda sin pagar.
 *  - hechas = turnos confirmados del plan de hoy o antes; agendadas = los
 *    futuros; restantes = sesiones − hechas − agendadas.
 *  - Una sesión futura por vez (MAX_AGENDADAS): cuando se hace, agenda la que
 *    sigue. No ocupa la agenda de Ceci con todo el paquete.
 *  - Solo en sede física (Montevideo o San José), en un horario libre.
 *  - Cambiarla: /mi-turno con su código, mismas reglas que cualquier turno.
 *
 * Los turnos sueltos (una sola consulta o sesión) siguen por /reservar.
 */

import { hoyUY } from './pacientes';
import { duracionDeTurno, labelFecha, sedeKeyDeSlug } from './agenda';
import { crearEventoReserva } from './calendar';
import { notificarReservaConfirmada } from './email';
import { linkAutogestion, fechaLarga } from './reprogramar';
import { enviarWhatsApp } from './whatsapp';
import { sedeConDireccion } from '../data/sedes';

/** Sesiones futuras que puede tener agendadas a la vez por plan. */
export const MAX_AGENDADAS = 1;
export const SEDES_SESION = [
  { slug: 'montevideo', nombre: 'Montevideo' },
  { slug: 'san-jose', nombre: 'San José' },
] as const;

export type PlanPaciente = {
  id: string;
  tratamiento: string;
  sesiones: number | null;
  frecuencia: string | null;
  estado: string;
  habilitado: boolean;
  hechas: number;
  agendadas: number;
  restantes: number | null;
  /** fechas de las sesiones hechas, de la más vieja a la más nueva */
  fechasHechas: string[];
  /** turnos futuros: fecha, hora, sede y código para cambiarlo */
  proximas: { fecha: string; hora: string | null; sede: string; token: string | null }[];
  proxima_fecha: string | null;
  puedeAgendar: boolean;
};

/** Planes en curso o pausados de la paciente, con el conteo de sesiones. */
export async function planesDePaciente(sql: any, pacienteId: string): Promise<PlanPaciente[]> {
  const hoy = hoyUY();
  const planes = (await sql`
    select pl.id, pl.tratamiento, pl.sesiones, pl.frecuencia, pl.estado, pl.habilitado_at is not null as habilitado
      from planes pl
     where pl.paciente_id = ${pacienteId} and pl.estado in ('en_curso', 'pausado')
     order by pl.created_at desc
  `) as any[];
  if (!planes.length) return [];
  const ids = planes.map((p) => p.id);
  const turnos = (await sql`
    select r.plan_id, r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora, coalesce(s.nombre, '') as sede,
           r.token_gestion, r.proxima_fecha::text as proxima_fecha
      from reservas r left join sedes s on s.id = r.sede_id
     where r.plan_id = any(${ids}::uuid[]) and r.estado = 'confirmada' and r.fecha is not null
     order by r.fecha, r.hora nulls first
  `) as any[];
  return planes.map((p) => {
    const t = turnos.filter((x) => x.plan_id === p.id);
    const hechas = t.filter((x) => x.fecha <= hoy);
    const futuras = t.filter((x) => x.fecha > hoy);
    const sesiones = p.sesiones != null ? Number(p.sesiones) : null;
    const restantes = sesiones != null ? Math.max(0, sesiones - hechas.length - futuras.length) : null;
    return {
      id: p.id,
      tratamiento: p.tratamiento,
      sesiones,
      frecuencia: p.frecuencia,
      estado: p.estado,
      habilitado: !!p.habilitado,
      hechas: hechas.length,
      agendadas: futuras.length,
      restantes,
      fechasHechas: hechas.map((x) => x.fecha),
      proximas: futuras.map((x) => ({ fecha: x.fecha, hora: x.hora, sede: x.sede, token: x.token_gestion })),
      proxima_fecha: [...hechas].reverse().find((x) => x.proxima_fecha)?.proxima_fecha ?? null,
      puedeAgendar:
        !!p.habilitado && p.estado === 'en_curso' && (restantes ?? 0) > 0 && futuras.length < MAX_AGENDADAS,
    };
  });
}

/** Por qué no puede agendar (para mostrarle algo claro). */
export function motivoNoAgenda(p: PlanPaciente): string | null {
  if (p.puedeAgendar) return null;
  if (!p.habilitado) return 'Ceci todavía no habilitó este tratamiento para que agendes sola. Si ya lo pagaste, escribile.';
  if (p.estado !== 'en_curso') return 'Este tratamiento está en pausa. Para retomarlo, escribile a Ceci.';
  if (p.sesiones == null) return 'Para agendar, Ceci tiene que cargar cuántas sesiones incluye. Escribile.';
  if (p.restantes === 0) return 'Ya agendaste o hiciste todas las sesiones de este tratamiento.';
  if (p.agendadas >= MAX_AGENDADAS) return 'Ya tenés tu próxima sesión agendada. Después de hacerla, podés agendar la siguiente.';
  return null;
}

type Paciente = { id: string; nombre: string; email: string | null; telefono: string | null };

/**
 * Agenda la próxima sesión de un plan. Turno confirmado, sin seña, con plan_id.
 * En producción le llegan la confirmación a la paciente y el aviso a Ceci, y se
 * crea el evento en su calendario. Fuera de producción no sale nada de eso
 * (los previews tienen una copia de la base y comparten el calendario de Ceci).
 */
export async function agendarSesion(
  sql: any,
  p: Paciente,
  planId: string,
  sedeSlug: string,
  fecha: string,
  hora: string
): Promise<{ ok: true; fecha: string; hora: string; sede: string; prueba: boolean } | { ok: false; status: number; error: string }> {
  const sede = SEDES_SESION.find((s) => s.slug === sedeSlug);
  if (!sede) return { ok: false, status: 400, error: 'Elegí la sede.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^\d{2}:\d{2}$/.test(hora)) return { ok: false, status: 400, error: 'Elegí el día y el horario.' };
  const plan = (await planesDePaciente(sql, p.id)).find((x) => x.id === planId);
  if (!plan) return { ok: false, status: 404, error: 'No encontramos ese tratamiento.' };
  if (!plan.puedeAgendar) return { ok: false, status: 409, error: motivoNoAgenda(plan) ?? 'No se puede agendar.' };
  if (fecha <= hoyUY()) return { ok: false, status: 400, error: 'Elegí un día a partir de mañana.' };

  const sedeKey = await sedeKeyDeSlug(sql, sede.slug);
  if (sedeKey === 'online') return { ok: false, status: 400, error: 'Esa sede no está disponible.' };
  // También valida que el horario exista (y no esté bloqueado).
  const duracion = await duracionDeTurno(sql, sedeKey, fecha, hora);
  if (duracion == null) return { ok: false, status: 409, error: 'Ese horario ya no está disponible. Elegí otro.' };

  const nota = `Sesión de ${plan.tratamiento} (agendada por la paciente desde su cuenta, plan pago)`;
  let ins: any[];
  try {
    ins = (await sql`
      insert into reservas
        (modalidad, sede_id, fecha, hora, nombre, telefono, email, estado, duracion_min, paciente_id, plan_id,
         notas, pagado, forma_pago)
      values ('sesion', ${sedeKey}, ${fecha}, ${hora}, ${p.nombre}, ${p.telefono || '—'}, ${p.email}, 'confirmada',
              ${duracion}, ${p.id}, ${planId}, ${nota}, true, 'paquete')
      returning id, token_gestion
    `) as any[];
  } catch (e: any) {
    if (e?.code === '23505' || String(e?.message ?? e).includes('reservas_slot_unico'))
      return { ok: false, status: 409, error: 'Alguien tomó ese horario recién. Elegí otro.' };
    throw e;
  }
  // Doble toque o dos pestañas: si quedaron más futuras que las permitidas, se borra esta.
  const fut = (await sql`
    select count(*)::int as n from reservas
     where plan_id = ${planId} and estado = 'confirmada' and fecha > ${hoyUY()}::date
  `) as any[];
  if ((fut[0]?.n ?? 0) > MAX_AGENDADAS) {
    await sql`delete from reservas where id = ${ins[0].id}`;
    return { ok: false, status: 409, error: 'Ya tenés tu próxima sesión agendada.' };
  }

  const prueba = process.env.VERCEL_ENV !== 'production';
  if (!prueba) await avisarSesionAgendada(sql, String(ins[0].id), p, plan.tratamiento, sede.nombre, fecha, hora, duracion, ins[0].token_gestion);
  return { ok: true, fecha, hora, sede: sede.nombre, prueba };
}

async function avisarSesionAgendada(
  sql: any, reservaId: string, p: Paciente, tratamiento: string, sede: string,
  fecha: string, hora: string, duracionMin: number, token: string | null
) {
  const servicio = `Sesión de ${tratamiento}`;
  // Se esperan (no fire-and-forget): en serverless lo colgado puede no salir.
  await notificarReservaConfirmada(
    {
      modalidad: servicio, sede, fechaLabel: labelFecha(fecha), hora,
      nombre: p.nombre, telefono: p.telefono || '—', email: p.email, sena: null, linkCambio: linkAutogestion(token),
    },
    { online: false }
  );
  if (p.telefono) {
    await enviarWhatsApp('confirmado', p.telefono, {
      nombre: p.nombre, servicio, fechaLarga: fechaLarga(fecha), hora, sede, token,
    }).catch(() => null);
  }
  const ev = await crearEventoReserva({
    resumen: `${servicio} — ${p.nombre}`,
    descripcion: [
      `Servicio: ${servicio} (paquete pago, agendada por la paciente)`,
      `Sede: ${sedeConDireccion(sede)}`,
      `Cliente: ${p.nombre}`,
      p.telefono ? `WhatsApp: ${p.telefono}` : '',
      p.email ? `Email: ${p.email}` : '',
    ].filter(Boolean).join('\n'),
    fecha, hora, duracionMin,
  }).catch(() => ({ ok: false } as any));
  if (ev?.ok && ev.eventId) {
    try { await sql`update reservas set google_event_id = ${ev.eventId} where id = ${reservaId}`; }
    catch (e) { console.error('No se pudo guardar google_event_id:', e instanceof Error ? e.message : e); }
  }
}

/**
 * PUNTO DE ENGANCHE CON LA COMPRA ONLINE (#26, sin mergear todavía).
 * Cuando el webhook da por pagada la compra de un paquete, llamar a esto con la
 * ficha de la paciente: crea el plan con sus sesiones. Queda pendiente de que
 * Ceci lo habilite, salvo PLANES_AUTO_DESDE_COMPRA=true (entonces la paciente
 * agenda sola apenas paga). Idempotente por compra_id (un webhook repetido no
 * duplica el plan). Requiere ensurePlanesAgenda antes.
 */
export async function crearPlanDesdeCompra(
  sql: any,
  c: { pacienteId: string; compraId: string; tratamientoId: string | null; tratamiento: string; sesiones: number; paquete?: string | null }
): Promise<string | null> {
  const auto = process.env.PLANES_AUTO_DESDE_COMPRA === 'true';
  const r = (await sql`
    insert into planes (paciente_id, tratamiento_id, tratamiento, sesiones, inicio, paquete, estado,
                        compra_id, habilitado_at, habilitado_por)
    values (${c.pacienteId}, ${c.tratamientoId}, ${c.tratamiento}, ${c.sesiones}, ${hoyUY()}, ${c.paquete ?? null},
            'en_curso', ${c.compraId}, ${auto ? new Date().toISOString() : null}, ${auto ? 'compra' : null})
    on conflict (compra_id) where compra_id is not null do nothing
    returning id
  `) as any[];
  return r[0]?.id ?? null;
}
