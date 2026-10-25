import type { APIRoute } from 'astro';
import { getSql, ensureConfirmacion, ensureSeguimiento } from '../../../lib/db';
import { isAdmin } from '../../../lib/admin';
import { hoyUY } from '../../../lib/pacientes';
import {
  CATALOGO, anamnesisValida, etiquetaValida, fechaOk, fotosBytes, fotosTopeMB, objetivosValidos,
  planValido, planesDe, tipoImagen, toleranciaValida,
} from '../../../lib/seguimiento';

export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json' } });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = (v: unknown) => (typeof v === 'string' && UUID.test(v) ? v : null);
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const MB = 1024 * 1024;

async function preparar() {
  const sql = getSql();
  await ensureConfirmacion(sql);
  await ensureSeguimiento(sql);
  return sql;
}

/**
 * GET /api/admin/seguimiento?id=<paciente>
 * Todo lo clínico de una ficha: anamnesis, objetivos, planes (con sesiones
 * hechas), sesiones registradas, turnos realizados (para elegir al registrar
 * una sesión) y fotos (solo los datos; la imagen sale de /api/admin/foto).
 */
export const GET: APIRoute = async ({ url, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  const id = uuid(url.searchParams.get('id'));
  if (!id) return json({ ok: false, error: 'Ficha inválida' }, 400);
  try {
    const sql = await preparar();
    const hoy = hoyUY();
    const f = (await sql`
      select consentimiento_fecha::text as consentimiento_fecha, motivo, objetivos, anamnesis, anamnesis_at
        from pacientes where id = ${id}
    `) as any[];
    if (!f.length) return json({ ok: false, error: 'No existe esa ficha' }, 404);
    const sesiones = (await sql`
      select r.id, r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora, r.modalidad,
             coalesce(s.nombre, '') as sede, r.plan_id, r.tratamientos, r.hizo, r.tolerancia,
             r.indicaciones, r.evolucion, r.proxima_fecha::text as proxima_fecha, r.notas
        from reservas r left join sedes s on s.id = r.sede_id
       where r.paciente_id = ${id} and r.estado = 'confirmada'
         and (r.hizo is not null or r.tratamientos is not null or r.evolucion is not null
              or r.tolerancia is not null or r.indicaciones is not null)
       order by r.fecha desc nulls last, r.hora desc nulls last
       limit 200
    `) as any[];
    // Turnos realizados (hoy o antes) que se pueden registrar o editar.
    const turnos = (await sql`
      select r.id, r.fecha::text as fecha, to_char(r.hora,'HH24:MI') as hora, r.modalidad,
             (r.hizo is not null or r.tratamientos is not null or r.evolucion is not null) as registrada
        from reservas r
       where r.paciente_id = ${id} and r.estado = 'confirmada'
         and r.fecha is not null and r.fecha <= ${hoy}::date
       order by r.fecha desc, r.hora desc nulls last
       limit 30
    `) as any[];
    const fotos = (await sql`
      select id, fecha::text as fecha, etiqueta, reserva_id, bytes
        from fotos where paciente_id = ${id}
       order by fecha desc, created_at desc
    `) as any[];
    return json({
      ok: true,
      hoy,
      ...f[0],
      anamnesis: f[0].anamnesis ?? null,
      objetivos: f[0].objetivos ?? [],
      planes: await planesDe(sql, id),
      sesiones,
      turnos,
      fotos,
      fotosMB: Math.round((await fotosBytes(sql)) / MB * 10) / 10,
      topeMB: fotosTopeMB(),
    });
  } catch (e) {
    console.error('GET /api/admin/seguimiento:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo cargar el seguimiento.' }, 500);
  }
};

/**
 * POST /api/admin/seguimiento  (todas requieren el consentimiento cargado)
 *  { accion: 'anamnesis', id, motivo?, objetivos?, anamnesis? } → guarda lo que venga
 *  { accion: 'plan', id, plan_id?, tratamiento_id, tratamiento?, sesiones, frecuencia,
 *    inicio, paquete, protocolo, estado }                       → crea o edita un plan
 *  { accion: 'sesion', id, reserva_id? | fecha, plan_id? | tratamiento_id/tratamiento,
 *    hizo, tolerancia, indicaciones, evolucion, proxima_fecha }   → registra una sesión
 *  { accion: 'foto', id, fecha, etiqueta, reserva_id?, datos, mini } (base64, JPEG/WebP)
 *  { accion: 'foto-borrar', id, foto_id }
 */
export const POST: APIRoute = async ({ request, cookies }) => {
  if (!isAdmin(cookies)) return json({ ok: false, error: 'No autorizado' }, 401);
  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'Cuerpo inválido' }, 400);
  }
  const id = uuid(body?.id);
  if (!id) return json({ ok: false, error: 'Ficha inválida' }, 400);

  try {
    const sql = await preparar();
    const hoy = hoyUY();
    const f = (await sql`select nombre, telefono, email, consentimiento_fecha from pacientes where id = ${id}`) as any[];
    if (!f.length) return json({ ok: false, error: 'No existe esa ficha' }, 404);
    // Datos de salud: sin el consentimiento firmado registrado, no se escribe nada.
    if (!f[0].consentimiento_fecha)
      return json({ ok: false, error: 'Primero cargá en Datos la fecha del consentimiento firmado.' }, 409);

    if (body.accion === 'anamnesis') {
      if ('motivo' in body) await sql`update pacientes set motivo = ${str(body.motivo, 1000) || null}, updated_at = now() where id = ${id}`;
      if ('objetivos' in body) await sql`update pacientes set objetivos = ${objetivosValidos(body.objetivos)}::text[], updated_at = now() where id = ${id}`;
      if ('anamnesis' in body) {
        await sql`
          update pacientes set anamnesis = ${JSON.stringify(anamnesisValida(body.anamnesis))}::jsonb,
                 anamnesis_at = now(), updated_at = now()
           where id = ${id}
        `;
      }
      return json({ ok: true });
    }

    if (body.accion === 'plan') {
      const p = planValido(body);
      if ('error' in p) return json({ ok: false, error: p.error }, 400);
      const planId = uuid(body.plan_id);
      if (planId) {
        const r = (await sql`
          update planes set tratamiento_id = ${p.tratamiento_id}, tratamiento = ${p.tratamiento},
                 sesiones = ${p.sesiones}, frecuencia = ${p.frecuencia}, inicio = ${p.inicio},
                 paquete = ${p.paquete}, protocolo = ${p.protocolo}, estado = ${p.estado}, updated_at = now()
           where id = ${planId} and paciente_id = ${id}
          returning id
        `) as any[];
        if (!r.length) return json({ ok: false, error: 'No existe ese plan' }, 404);
        return json({ ok: true, plan_id: planId });
      }
      const r = (await sql`
        insert into planes (paciente_id, tratamiento_id, tratamiento, sesiones, frecuencia, inicio, paquete, protocolo, estado)
        values (${id}, ${p.tratamiento_id}, ${p.tratamiento}, ${p.sesiones}, ${p.frecuencia},
                ${p.inicio ?? hoy}, ${p.paquete}, ${p.protocolo}, ${p.estado})
        returning id
      `) as any[];
      return json({ ok: true, plan_id: String(r[0].id) });
    }

    if (body.accion === 'sesion') {
      const tolerancia = body.tolerancia ? toleranciaValida(body.tolerancia) : null;
      if (body.tolerancia && !tolerancia) return json({ ok: false, error: 'Tolerancia inválida' }, 400);
      const prox = str(body.proxima_fecha, 10);
      if (prox && !fechaOk(prox)) return json({ ok: false, error: 'La próxima fecha no es válida.' }, 400);

      // 1. El turno: uno realizado de la agenda, o uno nuevo sin hora con la fecha.
      let rid = uuid(body.reserva_id);
      let fecha: string;
      let actual: any = null;
      if (rid) {
        const r = (await sql`
          select id, fecha::text as fecha, plan_id, tratamientos from reservas
           where id = ${rid} and paciente_id = ${id} and estado = 'confirmada'
             and fecha is not null and fecha <= ${hoy}::date
        `) as any[];
        if (!r.length) return json({ ok: false, error: 'Ese turno no se puede registrar (tiene que ser de hoy o anterior).' }, 400);
        actual = r[0];
        fecha = actual.fecha;
      } else {
        fecha = str(body.fecha, 10);
        if (!fechaOk(fecha) || fecha > hoy || fecha < '2015-01-01')
          return json({ ok: false, error: 'Elegí la fecha de la sesión (hoy o anterior).' }, 400);
      }
      if (prox && prox <= fecha) return json({ ok: false, error: 'La próxima sesión tiene que ser después de esta.' }, 400);

      // 2. Qué tratamiento: el de un plan (suma "sesión N de M") o uno suelto.
      let planId = uuid(body.plan_id);
      let tratamientos: any[] | null = null;
      let plan: any = null;
      if (planId) {
        const p = (await sql`
          select id, tratamiento_id, tratamiento, sesiones, estado from planes where id = ${planId} and paciente_id = ${id}
        `) as any[];
        if (!p.length) return json({ ok: false, error: 'No existe ese plan' }, 404);
        plan = p[0];
        const previa = actual?.plan_id === planId && Array.isArray(actual?.tratamientos) ? actual.tratamientos[0]?.sesion : null;
        let n = previa;
        if (!n) {
          const c = (await sql`
            select count(*)::int as n from reservas
             where plan_id = ${planId} and estado = 'confirmada' and id <> ${rid ?? '00000000-0000-0000-0000-000000000000'}::uuid
          `) as any[];
          n = (c[0]?.n ?? 0) + 1;
        }
        tratamientos = [{ id: plan.tratamiento_id ?? 'otro', nombre: plan.tratamiento, sesion: n, de: plan.sesiones ?? null }];
      } else {
        planId = null;
        const tid = str(body.tratamiento_id, 60);
        const nombre = tid && tid !== 'otro' ? CATALOGO.get(tid) : str(body.tratamiento, 80);
        if (tid && !nombre) return json({ ok: false, error: 'Elegí el tratamiento (o escribí cuál, si es otro).' }, 400);
        if (nombre) tratamientos = [{ id: tid && tid !== 'otro' ? tid : 'otro', nombre, sesion: null, de: null }];
      }

      if (!rid) {
        const r = (await sql`
          insert into reservas (modalidad, fecha, hora, nombre, telefono, email, estado, paciente_id)
          values ('manual', ${fecha}, null, ${f[0].nombre}, ${f[0].telefono || '—'}, ${f[0].email}, 'confirmada', ${id})
          returning id
        `) as any[];
        rid = String(r[0].id);
      }
      await sql`
        update reservas
           set plan_id = ${planId}, tratamientos = ${tratamientos ? JSON.stringify(tratamientos) : null}::jsonb,
               hizo = ${str(body.hizo, 2000) || null}, tolerancia = ${tolerancia},
               indicaciones = ${str(body.indicaciones, 2000) || null}, evolucion = ${str(body.evolucion, 4000) || null},
               proxima_fecha = ${prox || null}, atencion_at = now()
         where id = ${rid}
      `;
      // Si con esta sesión se completó el plan, queda terminado.
      if (plan && plan.sesiones && tratamientos?.[0]?.sesion >= plan.sesiones && plan.estado === 'en_curso')
        await sql`update planes set estado = 'terminado', updated_at = now() where id = ${planId}`;
      return json({ ok: true, reserva_id: rid, sesion: tratamientos?.[0]?.sesion ?? null });
    }

    if (body.accion === 'foto') {
      const fecha = str(body.fecha, 10);
      if (!fechaOk(fecha) || fecha > hoy) return json({ ok: false, error: 'Elegí la fecha de la foto.' }, 400);
      const datos = Buffer.from(String(body.datos ?? ''), 'base64');
      const mini = Buffer.from(String(body.mini ?? ''), 'base64');
      const mime = tipoImagen(datos);
      if (!mime || !tipoImagen(mini)) return json({ ok: false, error: 'La foto tiene que ser JPEG o WebP.' }, 400);
      if (datos.length > 1.5 * MB || mini.length > 150 * 1024) return json({ ok: false, error: 'La foto es demasiado grande.' }, 400);
      const usado = await fotosBytes(sql);
      if (usado + datos.length + mini.length > fotosTopeMB() * MB)
        return json({ ok: false, error: `Se llenó el espacio para fotos (${fotosTopeMB()} MB). Avisale a Sebas.` }, 409);
      const rid = uuid(body.reserva_id);
      const r = (await sql`
        insert into fotos (paciente_id, reserva_id, fecha, etiqueta, mime, datos, mini, bytes)
        select ${id}, r.id, ${fecha}, ${etiquetaValida(body.etiqueta)}, ${mime},
               decode(${datos.toString('hex')}, 'hex'), decode(${mini.toString('hex')}, 'hex'), ${datos.length + mini.length}
          from (select ${rid}::uuid as id) x
          left join reservas r on r.id = x.id and r.paciente_id = ${id}
        returning id
      `) as any[];
      return json({ ok: true, foto_id: String(r[0].id) });
    }

    if (body.accion === 'foto-borrar') {
      const fid = uuid(body.foto_id);
      if (!fid) return json({ ok: false, error: 'Foto inválida' }, 400);
      await sql`delete from fotos where id = ${fid} and paciente_id = ${id}`;
      return json({ ok: true });
    }

    return json({ ok: false, error: 'Acción desconocida' }, 400);
  } catch (e) {
    console.error('POST /api/admin/seguimiento:', e instanceof Error ? e.message : e);
    return json({ ok: false, error: 'No se pudo guardar. Probá de nuevo.' }, 500);
  }
};
