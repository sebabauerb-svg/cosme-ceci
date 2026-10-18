/**
 * FICHAS DE PACIENTES + "VOLVÉ A CONSULTAR"
 * =========================================
 * Cada paciente tiene una ficha (tabla `pacientes`, ver ensurePacientes en
 * db.ts) y cada reserva apunta a la suya (`reservas.paciente_id`).
 *
 * Vinculación: una reserva se asigna a la ficha con el mismo teléfono o email
 * (normalizados: '098 123 456' y '+59898123456' son la misma). Si no hay
 * ninguna, se crea. Así las fichas se precargan solas desde las reservas que
 * ya existían y cada reserva nueva queda vinculada.
 *
 * Recordatorio "volvé a consultar": un mes después de la última consulta
 * realizada, si la paciente no tiene otro turno agendado (ni a confirmar), se
 * le manda una invitación a reservar, UNA vez por consulta (marca
 * `reservas.vuelta_avisada_at`). No sale si Ceci lo apagó en la ficha ni si la
 * paciente pidió la baja (/pacientes/baja?t=<token_baja>).
 */

import crypto from 'node:crypto';
import { telefonoE164, enviarWhatsApp, whatsappConfigurado } from './whatsapp';
import { notificarVolverConsulta } from './email';

/** Consultas que ya cuentan para el recordatorio: desde un mes atrás… */
const VUELTA_DESDE = '1 month';
/** …hasta dos meses atrás. Las más viejas no se recuerdan: sin este tope, el
 *  primer día se le escribiría a todas las pacientes de los últimos años. */
const VUELTA_HASTA = '2 months';
/** Tope por corrida: Resend gratis manda 100 mails/día en total (turnos incluidos). */
const VUELTA_TOPE = 30;

/** Estados que ocupan un turno a futuro (pendiente_pago/a_confirmar mientras no vencen). */
const ACTIVOS = ['confirmada', 'a_confirmar', 'pendiente_pago'];

export const hoyUY = () => new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);

export function normTel(tel: unknown): string | null {
  const raw = typeof tel === 'string' ? tel.trim() : '';
  if (!raw || raw === '—') return null;
  const e164 = telefonoE164(raw);
  if (e164) return e164;
  const d = raw.replace(/\D/g, '');
  return d.length >= 6 ? d : null;
}

export function normEmail(v: unknown): string | null {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  return e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : null;
}

/** Base de los links (dominio canónico; origin del request en previews y local). */
export { baseUrl } from './newsletter';

type Ficha = { id: string; tel_norm: string | null; email_norm: string | null; telefono: string | null; email: string | null; nombre: string };

/**
 * Vincula a su ficha las reservas que no tienen. Con `soloReserva`, solo esa
 * (después de crear una reserva o de corregirle los datos de contacto).
 * Devuelve cuántas vinculó. Requiere ensurePacientes antes.
 *
 * Reglas:
 *  - coincide teléfono o email normalizado → esa ficha (y si a la ficha le
 *    faltaba el otro dato, se completa con el de la reserva).
 *  - sin coincidencia → ficha nueva, salvo que la reserva esté vencida o
 *    cancelada (no creamos fichas de quien nunca llegó a reservar).
 *  - sin teléfono ni email (turnos marcados a mano, solo con nombre): solo con
 *    `soloReserva`, y solo si hay UNA ficha con ese mismo nombre.
 * Se recorren de la más nueva a la más vieja: los datos más recientes mandan.
 */
export async function vincularPendientes(sql: any, soloReserva?: string): Promise<number> {
  const reservas = (soloReserva
    ? await sql`
        select id, nombre, telefono, email, estado::text as estado from reservas
         where id = ${soloReserva} and paciente_id is null`
    : await sql`
        select id, nombre, telefono, email, estado::text as estado from reservas
         where paciente_id is null
           and (coalesce(telefono, '') not in ('', '—') or email is not null)
         order by created_at desc
         limit 2000`) as any[];
  if (!reservas.length) return 0;

  const fichas = (await sql`select id, nombre, tel_norm, email_norm, telefono, email from pacientes`) as Ficha[];
  const porTel = new Map<string, Ficha>();
  const porEmail = new Map<string, Ficha>();
  const porNombre = new Map<string, Ficha[]>();
  const registrar = (f: Ficha) => {
    if (f.tel_norm && !porTel.has(f.tel_norm)) porTel.set(f.tel_norm, f);
    if (f.email_norm && !porEmail.has(f.email_norm)) porEmail.set(f.email_norm, f);
    const n = f.nombre.trim().toLowerCase();
    porNombre.set(n, [...(porNombre.get(n) ?? []), f]);
  };
  fichas.forEach(registrar);

  const nuevas: (Ficha & { nueva: true })[] = [];
  const completar = new Map<string, Ficha>();
  const links: [string, string][] = [];

  for (const r of reservas) {
    const t = normTel(r.telefono);
    const e = normEmail(r.email);
    let f = (t && porTel.get(t)) || (e && porEmail.get(e)) || null;
    if (!f && !t && !e) {
      const mismos = porNombre.get(String(r.nombre ?? '').trim().toLowerCase()) ?? [];
      if (mismos.length === 1) f = mismos[0];
    }
    if (f) {
      // Completar lo que le falte a la ficha (nunca pisar lo que ya tiene).
      let cambio = false;
      if (t && !f.tel_norm) { f.tel_norm = t; f.telefono = String(r.telefono).trim(); cambio = true; }
      if (e && !f.email_norm) { f.email_norm = e; f.email = String(r.email).trim(); cambio = true; }
      if (cambio) {
        if (t) porTel.set(t, f);
        if (e) porEmail.set(e, f);
        if (!(f as any).nueva) completar.set(f.id, f);
      }
    } else if ((t || e) && !['expirada', 'cancelada'].includes(r.estado)) {
      f = {
        id: crypto.randomUUID(),
        nombre: String(r.nombre ?? '').trim() || 'Sin nombre',
        tel_norm: t,
        email_norm: e,
        telefono: t ? String(r.telefono).trim() : null,
        email: e ? String(r.email).trim() : null,
        nueva: true,
      };
      nuevas.push(f as Ficha & { nueva: true });
      registrar(f);
    }
    if (f) links.push([String(r.id), f.id]);
  }

  if (nuevas.length) {
    await sql`
      insert into pacientes (id, nombre, telefono, email, tel_norm, email_norm)
      select * from unnest(
        ${nuevas.map((f) => f.id)}::uuid[], ${nuevas.map((f) => f.nombre)}::text[],
        ${nuevas.map((f) => f.telefono)}::text[], ${nuevas.map((f) => f.email)}::text[],
        ${nuevas.map((f) => f.tel_norm)}::text[], ${nuevas.map((f) => f.email_norm)}::text[])
    `;
  }
  for (const f of completar.values()) {
    await sql`
      update pacientes
         set telefono = coalesce(telefono, ${f.telefono}), tel_norm = coalesce(tel_norm, ${f.tel_norm}),
             email = coalesce(email, ${f.email}), email_norm = coalesce(email_norm, ${f.email_norm}),
             updated_at = now()
       where id = ${f.id}
    `;
  }
  if (links.length) {
    await sql`
      update reservas r set paciente_id = v.pid
        from unnest(${links.map((l) => l[0])}::uuid[], ${links.map((l) => l[1])}::uuid[]) as v(rid, pid)
       where r.id = v.rid and r.paciente_id is null
    `;
  }
  return links.length;
}

export type EstadoVuelta =
  | { tipo: 'sin-consulta' }
  | { tipo: 'apagado' }
  | { tipo: 'baja'; desde: string }
  | { tipo: 'sin-contacto' }
  | { tipo: 'turno'; fecha: string | null }
  | { tipo: 'enviado'; fecha: string; consulta: string }
  | { tipo: 'vencido'; consulta: string }
  | { tipo: 'programado'; desde: string; consulta: string }
  | { tipo: 'listo'; consulta: string };

/**
 * Situación del recordatorio de cada paciente (todas, o una con `soloPaciente`).
 * Es la misma regla que usa el envío: el panel muestra exactamente lo que el
 * cron va a hacer.
 */
export async function estadosVuelta(sql: any, soloPaciente?: string) {
  const hoy = hoyUY();
  const rows = (await sql`
    with ult as (
      select distinct on (r.paciente_id) r.paciente_id, r.id as reserva_id, r.fecha, r.vuelta_avisada_at
        from reservas r
       where r.paciente_id is not null and r.estado = 'confirmada' and r.fecha is not null
         and r.fecha < ${hoy}::date and r.modalidad <> 'club'
       order by r.paciente_id, r.fecha desc, r.hora desc nulls last
    ),
    prox as (
      select r.paciente_id, min(r.fecha)::text as fecha, count(*)::int as n
        from reservas r
       where r.paciente_id is not null and r.estado::text = any(${ACTIVOS}::text[])
         and (r.estado = 'confirmada' or r.expira_at is null or r.expira_at > now())
         and (r.fecha is null or r.fecha >= ${hoy}::date)
       group by r.paciente_id
    )
    select p.id, p.nombre, p.email, p.telefono, p.token_baja, p.recordatorio_activo,
           p.baja_recordatorios_at, u.reserva_id, u.fecha::text as ult_fecha, u.vuelta_avisada_at,
           (u.fecha + interval '1 month')::date::text as desde,
           (u.fecha <= ${hoy}::date - ${VUELTA_DESDE}::interval) as cumplio,
           (u.fecha <= ${hoy}::date - ${VUELTA_HASTA}::interval) as vencio,
           x.fecha as prox_fecha, coalesce(x.n, 0) as prox_n,
           exists (
             select 1 from reservas f
              where f.paciente_id is null and p.email_norm is not null
                and lower(trim(f.email)) = p.email_norm
                and f.estado::text = any(${ACTIVOS}::text[])
                and (f.estado = 'confirmada' or f.expira_at is null or f.expira_at > now())
                and (f.fecha is null or f.fecha >= ${hoy}::date)
           ) as turno_suelto
      from pacientes p
      left join ult u on u.paciente_id = p.id
      left join prox x on x.paciente_id = p.id
     where (${soloPaciente ?? null}::uuid is null or p.id = ${soloPaciente ?? null}::uuid)
  `) as any[];
  const waOn = whatsappConfigurado();
  return rows.map((r) => {
    let estado: EstadoVuelta;
    if (!r.reserva_id) estado = { tipo: 'sin-consulta' };
    else if (r.vuelta_avisada_at) estado = { tipo: 'enviado', fecha: new Date(r.vuelta_avisada_at).toISOString(), consulta: r.ult_fecha };
    else if (r.baja_recordatorios_at) estado = { tipo: 'baja', desde: new Date(r.baja_recordatorios_at).toISOString() };
    else if (!r.recordatorio_activo) estado = { tipo: 'apagado' };
    else if (r.prox_n > 0 || r.turno_suelto) estado = { tipo: 'turno', fecha: r.prox_fecha };
    else if (!normEmail(r.email) && !(waOn && normTel(r.telefono))) estado = { tipo: 'sin-contacto' };
    else if (r.vencio) estado = { tipo: 'vencido', consulta: r.ult_fecha };
    else if (!r.cumplio) estado = { tipo: 'programado', desde: r.desde, consulta: r.ult_fecha };
    else estado = { tipo: 'listo', consulta: r.ult_fecha };
    return { ...r, estado };
  });
}

/**
 * Manda el "volvé a consultar" a quienes les toca hoy (estado 'listo'). Con
 * `soloPaciente`, solo a esa (el botón de la ficha). Marca la consulta como
 * avisada aunque el mail falle: preferimos un recordatorio perdido antes que
 * repetirlo todos los días.
 */
export async function enviarVueltas(sql: any, base: string, soloPaciente?: string) {
  const listas = (await estadosVuelta(sql, soloPaciente)).filter((p) => p.estado.tipo === 'listo').slice(0, VUELTA_TOPE);
  const waOn = whatsappConfigurado();
  let emails = 0;
  let whatsapps = 0;
  for (const p of listas) {
    // Marca primero (condicional): si dos corridas se pisan, solo una manda.
    const marcada = (await sql`
      update reservas set vuelta_avisada_at = now()
       where id = ${p.reserva_id} and vuelta_avisada_at is null
      returning id
    `) as any[];
    if (!marcada.length) continue;
    const email = normEmail(p.email);
    if (email) {
      const ok = await notificarVolverConsulta({
        nombre: p.nombre,
        email,
        linkReservar: `${base}/reservar`,
        linkBaja: `${base}/pacientes/baja?t=${p.token_baja}`,
      });
      if (ok) emails++;
    }
    if (waOn && normTel(p.telefono)) {
      const wa = await enviarWhatsApp('volver', p.telefono, {
        nombre: p.nombre, servicio: '', fechaLarga: null, hora: null, sede: null, tokenBaja: p.token_baja,
      });
      if (wa.ok) whatsapps++;
    }
  }
  return { avisadas: listas.length, emails, whatsapps };
}

/** El link de baja trae 32 hex (ver token_baja en ensurePacientes). */
export const tokenValido = (t: unknown): t is string => typeof t === 'string' && /^[0-9a-f]{32}$/.test(t);

/** La paciente pide no recibir más el "volvé a consultar". true si el código existía. */
export async function darDeBajaVuelta(sql: any, token: string): Promise<boolean> {
  const r = (await sql`
    update pacientes set baja_recordatorios_at = coalesce(baja_recordatorios_at, now()), updated_at = now()
     where token_baja = ${token}
    returning id
  `) as any[];
  return r.length > 0;
}
