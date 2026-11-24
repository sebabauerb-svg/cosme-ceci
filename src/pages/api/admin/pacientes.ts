import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion, ensureSeguimiento } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { categoriasTratamientos } from '../../../data/tratamientos';
import {
  baseUrl, enviarVueltas, estadosVuelta, hoyUY, normEmail, normTel, vincularPendientes,
} from '../../../lib/pacientes';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Catálogo de tratamientos: id → nombre (lo que se puede registrar por consulta). */
const CATALOGO = new Map(categoriasTratamientos.flatMap((c) => c.tratamientos.map((t) => [t.id, t.nombre] as const)));

/** Valida la lista de tratamientos de una consulta. null = inválida. */
function tratamientosValidos(v: unknown): { id: string; nombre: string; sesion: number | null; de: number | null }[] | null {
  if (!Array.isArray(v) || v.length > 12) return null;
  const sesNum = (x: unknown) => {
    const n = Number(x);
    return x === '' || x == null ? null : Number.isInteger(n) && n >= 1 && n <= 50 ? n : NaN;
  };
  const out = [];
  for (const t of v) {
    const id = str(t?.id, 60);
    const nombre = id === 'otro' ? str(t?.nombre, 80) : CATALOGO.get(id);
    if (!nombre) return null;
    const sesion = sesNum(t?.sesion);
    const de = sesNum(t?.de);
    if (Number.isNaN(sesion) || Number.isNaN(de) || (sesion != null && de != null && sesion > de)) return null;
    out.push({ id, nombre, sesion, de });
  }
  return out;
}

async function preparar() {
  const sql = getSql();
  await ensureConfirmacion(sql);
  await ensureSeguimiento(sql);
  return sql;
}

/**
 * GET /api/admin/pacientes        → lista de fichas (con última consulta,
 *                                    próximo turno y estado del recordatorio)
 * GET /api/admin/pacientes?id=…   → una ficha con su historial de turnos
 * Cada GET vincula antes las reservas que todavía no tienen ficha: así la
 * lista se precarga sola desde las reservas existentes.
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const id = url.searchParams.get('id');
  if (id && !UUID.test(id)) return json({ ok: false, error: 'Ficha inválida' }, 400);
  try {
    const sql = await preparar();
    await vincularPendientes(sql);

    if (!id) {
      const extra = (await sql`
        select p.id, p.fecha_nacimiento::text as fecha_nacimiento,
               p.consentimiento_fecha is not null as consentimiento,
               (coalesce(jsonb_array_length(p.anamnesis->'antecedentes'), 0) > 0
                 or coalesce(p.anamnesis->>'alergias', '') <> '') as alertas,
               (select count(*)::int from reservas r
                 where r.paciente_id = p.id and r.estado = 'confirmada'
                   and r.fecha is not null and r.fecha < ${hoyUY()}::date) as consultas,
               pl.tratamiento as plan, pl.sesiones as plan_de,
               (select count(*)::int from reservas r where r.plan_id = pl.id and r.estado = 'confirmada') as plan_hechas
          from pacientes p
          left join lateral (
            select id, tratamiento, sesiones from planes
             where paciente_id = p.id and estado = 'en_curso'
             order by created_at desc limit 1
          ) pl on true
      `) as any[];
      const porId = new Map(extra.map((e) => [e.id, e]));
      const pacientes = (await estadosVuelta(sql))
        .map((p) => ({
          id: p.id, nombre: p.nombre, email: p.email, telefono: p.telefono,
          ultima: p.ult_fecha, proximo: p.prox_fecha, estado: p.estado,
          consultas: porId.get(p.id)?.consultas ?? 0,
          fecha_nacimiento: porId.get(p.id)?.fecha_nacimiento ?? null,
          consentimiento: porId.get(p.id)?.consentimiento ?? false,
          alertas: porId.get(p.id)?.alertas ?? false,
          plan: porId.get(p.id)?.plan
            ? { tratamiento: porId.get(p.id).plan, hechas: porId.get(p.id).plan_hechas, de: porId.get(p.id).plan_de }
            : null,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
      return json({ ok: true, pacientes, hoy: hoyUY() });
    }

    const f = (await sql`
      select id, nombre, fecha_nacimiento::text as fecha_nacimiento, email, telefono, notas,
             recordatorio_activo, baja_recordatorios_at, consentimiento_fecha::text as consentimiento_fecha, created_at
        from pacientes where id = ${id}
    `) as any[];
    if (!f.length) return json({ ok: false, error: 'No existe esa ficha' }, 404);
    const historial = (await sql`
      select r.id, r.modalidad, coalesce(s.nombre, '') as sede, r.fecha::text as fecha,
             to_char(r.hora,'HH24:MI') as hora, r.estado::text as estado, r.expira_at,
             r.vuelta_avisada_at, r.notas, r.tratamientos, r.evolucion
        from reservas r left join sedes s on s.id = r.sede_id
       where r.paciente_id = ${id}
       order by r.fecha desc nulls last, r.created_at desc
       limit 100
    `) as any[];
    const [ev] = await estadosVuelta(sql, id);
    return json({ ok: true, ficha: f[0], historial, estado: ev?.estado ?? null, hoy: hoyUY() });
  } catch (e) {
    console.error('GET /api/admin/pacientes:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudieron cargar las fichas.' }, 500);
  }
};

/**
 * POST /api/admin/pacientes
 *  { accion: 'guardar', id?, nombre, fecha_nacimiento, telefono, email, notas,
 *    recordatorio_activo, reactivar? }               → crea o edita la ficha
 *  { accion: 'consulta', id, fecha }                  → registra una consulta
 *    anterior (de antes de la web, o que no pasó por la agenda)
 *  { accion: 'atencion', id, reserva_id, tratamientos, evolucion }
 *                                                     → registra qué se hizo en
 *    esa consulta (requiere consentimiento_fecha en la ficha)
 *  { accion: 'vuelta', id }                           → manda ahora el
 *    "volvé a consultar" a esta paciente, si le corresponde (misma regla que el cron)
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }
  const id = typeof body?.id === 'string' && UUID.test(body.id) ? body.id : null;

  try {
    const sql = await preparar();

    if (body?.accion === 'guardar') {
      const nombre = str(body.nombre, 120);
      const telefono = str(body.telefono, 40);
      const email = str(body.email, 160);
      const notas = str(body.notas, 1000);
      const nac = str(body.fecha_nacimiento, 10);
      const consent = str(body.consentimiento_fecha, 10);
      if (consent && (!/^\d{4}-\d{2}-\d{2}$/.test(consent) || consent < '2015-01-01' || consent > hoyUY()))
        return json({ ok: false, error: 'La fecha del consentimiento no es válida.' }, 400);
      if (nombre.length < 2) return json({ ok: false, error: 'Poné el nombre (2 letras o más).' }, 400);
      const tn = telefono ? normTel(telefono) : null;
      if (telefono && !tn) return json({ ok: false, error: 'El teléfono no parece válido.' }, 400);
      const en = email ? normEmail(email) : null;
      if (email && !en) return json({ ok: false, error: 'El email no parece válido.' }, 400);
      if (nac && (!/^\d{4}-\d{2}-\d{2}$/.test(nac) || nac < '1900-01-01' || nac > hoyUY()))
        return json({ ok: false, error: 'La fecha de nacimiento no es válida.' }, 400);
      const activo = body.recordatorio_activo !== false;

      // Una persona, una ficha: no dejar dos fichas con el mismo teléfono o email.
      const dup = (await sql`
        select id, nombre from pacientes
         where (${tn}::text is not null and tel_norm = ${tn} or ${en}::text is not null and email_norm = ${en})
           and (${id}::uuid is null or id <> ${id}::uuid)
         limit 1
      `) as any[];
      if (dup.length)
        return json({ ok: false, error: `Ya hay una ficha con ese teléfono o email: ${dup[0].nombre}.`, id: dup[0].id }, 409);

      let fichaId = id;
      if (id) {
        const r = (await sql`
          update pacientes
             set nombre = ${nombre}, telefono = ${telefono || null}, tel_norm = ${tn},
                 email = ${email || null}, email_norm = ${en}, notas = ${notas || null},
                 fecha_nacimiento = ${nac || null}, recordatorio_activo = ${activo},
                 consentimiento_fecha = ${consent || null},
                 baja_recordatorios_at = case when ${body.reactivar === true} then null else baja_recordatorios_at end,
                 updated_at = now()
           where id = ${id}
          returning id
        `) as any[];
        if (!r.length) return json({ ok: false, error: 'No existe esa ficha' }, 404);
      } else {
        const r = (await sql`
          insert into pacientes (nombre, telefono, tel_norm, email, email_norm, notas, fecha_nacimiento, recordatorio_activo, consentimiento_fecha)
          values (${nombre}, ${telefono || null}, ${tn}, ${email || null}, ${en}, ${notas || null}, ${nac || null}, ${activo}, ${consent || null})
          returning id
        `) as any[];
        fichaId = String(r[0].id);
      }
      // Con teléfono o email nuevos pueden aparecer reservas suyas sin ficha.
      await vincularPendientes(sql);
      return json({ ok: true, id: fichaId });
    }

    if (!id) return json({ ok: false, error: 'Ficha inválida' }, 400);

    if (body?.accion === 'consulta') {
      const fecha = str(body.fecha, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha >= hoyUY() || fecha < '2015-01-01')
        return json({ ok: false, error: 'Elegí una fecha anterior a hoy.' }, 400);
      const f = (await sql`select nombre, telefono, email from pacientes where id = ${id}`) as any[];
      if (!f.length) return json({ ok: false, error: 'No existe esa ficha' }, 404);
      // Sin hora y en el pasado: no ocupa ningún cupo de la agenda.
      await sql`
        insert into reservas (modalidad, fecha, hora, nombre, telefono, email, estado, paciente_id, notas)
        values ('manual', ${fecha}, null, ${f[0].nombre}, ${f[0].telefono || '—'}, ${f[0].email},
                'confirmada', ${id}, 'Consulta anterior cargada desde la ficha')
      `;
      return json({ ok: true });
    }

    if (body?.accion === 'atencion') {
      // Datos de salud: solo con el consentimiento firmado registrado en la ficha.
      const rid = typeof body.reserva_id === 'string' && UUID.test(body.reserva_id) ? body.reserva_id : null;
      if (!rid) return json({ ok: false, error: 'Consulta inválida' }, 400);
      const trats = tratamientosValidos(body.tratamientos ?? []);
      if (!trats) return json({ ok: false, error: 'Revisá los tratamientos (y que la sesión no sea mayor que el total).' }, 400);
      const evolucion = str(body.evolucion, 4000);
      const f = (await sql`select consentimiento_fecha from pacientes where id = ${id}`) as any[];
      if (!f.length) return json({ ok: false, error: 'No existe esa ficha' }, 404);
      if (!f[0].consentimiento_fecha)
        return json({ ok: false, error: 'Primero cargá en la ficha la fecha del consentimiento firmado.' }, 409);
      const r = (await sql`
        update reservas
           set tratamientos = ${trats.length ? JSON.stringify(trats) : null}::jsonb,
               evolucion = ${evolucion || null}, atencion_at = now()
         where id = ${rid} and paciente_id = ${id} and estado = 'confirmada'
           and fecha is not null and fecha <= ${hoyUY()}::date
        returning id
      `) as any[];
      if (!r.length) return json({ ok: false, error: 'Solo se registran consultas confirmadas de hoy o anteriores.' }, 400);
      return json({ ok: true });
    }

    if (body?.accion === 'vuelta') {
      const r = await enviarVueltas(sql, baseUrl(request), id);
      const [ev] = await estadosVuelta(sql, id);
      return json({ ok: true, ...r, estado: ev?.estado ?? null });
    }

    return json({ ok: false, error: 'Acción desconocida' }, 400);
  } catch (e) {
    console.error('POST /api/admin/pacientes:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo guardar. Probá de nuevo.' }, 500);
  }
};
