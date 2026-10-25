/**
 * Newsletter de novedades: suscripción con doble opt-in, baja sin login y
 * envío por lotes con Resend.
 *
 * Por qué lotes (POST /emails/batch) y no Broadcasts/Audiences de Resend: con
 * Audiences la lista vive en Resend y la baja también, así que habría que
 * sincronizar dos fuentes (y el consentimiento quedaría en otro lado). Con
 * lotes la base es la única fuente de verdad y cada mail lleva su propio link
 * de baja. Para una lista chica es lo más simple y respeta igual los límites.
 *
 * Límites del plan gratis de Resend: 100 mails por día y 3.000 por mes, en
 * total (turnos + newsletter). Por eso cada día el newsletter usa como mucho
 * NEWSLETTER_TOPE_DIARIO (por defecto 80, deja lugar a los mails de turnos), y
 * si la lista es más grande el envío se completa en los días siguientes.
 *
 * Variables: RESEND_API_KEY, RESEND_FROM, PUBLIC_SITE_URL, CECI_NOTIF_EMAIL
 * (destino por defecto de la prueba), NEWSLETTER_TOPE_DIARIO (opcional).
 */

import crypto from 'node:crypto';
import { getCollection } from 'astro:content';
import { esc, remitente } from './email';
import { site } from '../data/site';
import { renderNewsletter } from './plantillas-newsletter';
import {
  CABECERA_POR_DEFECTO,
  RUTA_FIRMA,
  RUTA_LOGO,
  fotoValida,
  rutaCabecera,
  rutaFoto,
  type FotoId,
} from '../data/galeria-newsletter';

export const MAX_ENTRADAS = 3;
/** Resend acepta hasta 100 mails por llamada a /emails/batch. */
const LOTE_MAX = 100;
/** No reenviar el mail de confirmación más seguido que esto (evita spam a terceros). */
const REENVIO_MIN_MS = 10 * 60 * 1000;

export const topeDiario = () => {
  const n = Number(process.env.NEWSLETTER_TOPE_DIARIO);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 80;
};

export const resendConfigurado = () => !!process.env.RESEND_API_KEY;

export function normalizarEmail(v: unknown): string | null {
  const e = typeof v === 'string' ? v.trim().toLowerCase() : '';
  if (!e || e.length > 160 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return null;
  return e;
}

/**
 * Base de los links de los mails. En producción, el dominio canónico. En un
 * preview o en local, el origin del request: así los links de confirmar y de
 * baja apuntan a la misma base de datos con la que se probó.
 */
export function baseUrl(request: Request): string {
  const origin = new URL(request.url).origin;
  if (import.meta.env.DEV || process.env.VERCEL_ENV === 'preview') return origin;
  return (process.env.PUBLIC_SITE_URL || process.env.SITE_URL || origin).replace(/\/+$/, '');
}

// ---------- Envío por Resend ----------

type Mail = { to: string; subject: string; html: string; headers?: Record<string, string> };

async function resend(path: string, body: unknown, idempotencia?: string) {
  const res = await fetch(`https://api.resend.com${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      ...(idempotencia ? { 'Idempotency-Key': idempotencia } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const d: any = await res.json().catch(() => ({}));
    throw new Error(d?.message || `Resend respondió ${res.status}`);
  }
  return res.json().catch(() => ({}));
}

const enviarUno = (m: Mail) => resend('/emails', { from: remitente(), ...m });
const enviarLote = (ms: Mail[], idempotencia: string) =>
  resend('/emails/batch', ms.map((m) => ({ from: remitente(), ...m })), idempotencia);

// ---------- Plantillas ----------

const MARCA = `${site.marca.nombre} · ${site.marca.subtitulo}`;
const P = 'font-family:system-ui,sans-serif;line-height:1.7;color:#2a302b';

function marco(contenido: string, pie: string) {
  return `<div style="background:#f6f4ef;padding:24px 12px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:18px;padding:28px 24px">
    <p style="font-family:Georgia,serif;font-size:18px;color:#2a302b;margin:0">${esc(site.marca.nombre)}</p>
    <p style="font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#a76a4b;margin:2px 0 22px">${esc(site.marca.subtitulo)}</p>
    ${contenido}
  </div>
  <div style="max-width:560px;margin:14px auto 0;font-family:system-ui,sans-serif;font-size:12px;line-height:1.6;color:#55605a;text-align:center">${pie}</div>
</div>`;
}

export function htmlConfirmacion(link: string) {
  return marco(
    `<h2 style="font-family:Georgia,serif;color:#2a302b;margin:0 0 12px">Confirmá tu suscripción</h2>
     <p style="${P}">Pediste recibir por email las novedades, tips y notas de ${esc(MARCA)}. Para empezar a recibirlas, confirmá que este correo es tuyo:</p>
     <p style="margin:22px 0"><a href="${esc(link)}" style="display:inline-block;background:#5d7a63;color:#ffffff;text-decoration:none;font-family:system-ui,sans-serif;font-weight:600;padding:12px 22px;border-radius:999px">Sí, quiero recibirlas</a></p>
     <p style="${P};color:#55605a;font-size:14px">Si no lo pediste vos, ignorá este mensaje: sin confirmar no te vamos a escribir. Y si te suscribís, podés darte de baja cuando quieras desde el link al pie de cada mail.</p>`,
    `${esc(MARCA)} · Montevideo y San José, Uruguay`
  );
}

export type EntradaNl = { slug: string; titulo: string; descripcion: string; tipo: string; fecha: string; borrador?: boolean };

/**
 * En local y en los previews de Vercel también se ofrecen los borradores, para
 * poder probar el armado y la prueba sin publicar nada (igual que /blog muestra
 * los borradores en `npm run dev`). En producción, solo lo publicado.
 */
const verBorradores = () => import.meta.env.DEV || process.env.VERCEL_ENV === 'preview';

/** Entradas publicadas del blog (las que ya están en la web), de la más nueva a la más vieja. */
export async function entradasPublicadas(): Promise<EntradaNl[]> {
  const todas = await getCollection('blog', ({ data }) => data.publicado || verBorradores());
  return todas
    .sort((a, b) => b.data.fecha.getTime() - a.data.fecha.getTime())
    .map((e) => ({
      slug: e.id,
      titulo: e.data.titulo,
      descripcion: e.data.descripcion,
      tipo: e.data.tipo,
      fecha: e.data.fecha.toISOString().slice(0, 10),
      ...(e.data.publicado ? {} : { borrador: true }),
    }));
}

/** Fotos elegidas para un envío: la de cabecera y, opcional, una por novedad (slug → foto). */
export type FotosEnvio = { cabecera: FotoId; porEntrada: Record<string, FotoId> };

/**
 * Base de las imágenes del mail. Siempre el dominio público: los previews de
 * Vercel piden login y Gmail no podría bajarlas. En un preview, las fotos
 * nuevas recién se ven después del merge.
 */
const baseImagenes = () => (process.env.PUBLIC_SITE_URL || 'https://cgcosmetologiamedica.com').replace(/\/+$/, '');

/** `baseImg`: solo para la vista previa del panel, que puede cargar las fotos del mismo sitio. */
export function htmlNewsletter(o: { intro?: string | null; entradas: EntradaNl[]; base: string; linkBaja: string; fotos: FotosEnvio; baseImg?: string }) {
  const img = o.baseImg || baseImagenes();
  return renderNewsletter({
    preheader: o.entradas.map((e) => e.titulo).join(' · '),
    intro: o.intro,
    entradas: o.entradas.map((e) => {
      const foto = o.fotos.porEntrada[e.slug];
      return {
        titulo: e.titulo,
        descripcion: e.descripcion,
        tipo: e.tipo,
        url: `${o.base}/blog/${encodeURIComponent(e.slug)}`,
        imagen: foto ? img + rutaFoto(foto) : null,
      };
    }),
    cabecera: img + rutaCabecera(o.fotos.cabecera),
    base: o.base,
    linkBaja: o.linkBaja,
    logo: img + RUTA_LOGO,
    fotoCeci: img + RUTA_FIRMA,
  });
}

/** Lee y valida las fotos que manda el panel (o las guardadas en un envío). */
export function leerFotos(v: any, slugs: string[]): FotosEnvio {
  const cabecera = fotoValida(v?.cabecera) ? v.cabecera : CABECERA_POR_DEFECTO;
  const porEntrada: Record<string, FotoId> = {};
  for (const s of slugs) if (fotoValida(v?.porEntrada?.[s])) porEntrada[s] = v.porEntrada[s];
  return { cabecera, porEntrada };
}

// ---------- Suscripción ----------

const nuevoToken = () => crypto.randomBytes(16).toString('hex');

const linkConfirmar = (base: string, token: string) => `${base}/newsletter/confirmar?t=${token}`;
const enFreno = (enviadaAt: unknown) =>
  !!enviadaAt && Date.now() - new Date(enviadaAt as string).getTime() < REENVIO_MIN_MS;

const mailConfirmacion = (email: string, link: string) =>
  enviarUno({ to: email, subject: `Confirmá tu suscripción — ${MARCA}`, html: htmlConfirmacion(link) });

/**
 * Pide la suscripción de un email: lo guarda como 'pendiente' y le manda el mail
 * para confirmar. Siempre responde lo mismo hacia afuera (no revela si el email
 * ya estaba en la lista). Si ya estaba confirmado, no hace nada.
 *
 * `mandarMail: false` (desde /reservar): no manda un mail aparte; devuelve el
 * link de confirmación para que vaya dentro del mail de la reserva, que la
 * paciente sí abre. Así no recibe dos mails y el doble opt-in sigue igual.
 * Devuelve null si ya estaba confirmada.
 */
export async function pedirSuscripcion(
  sql: any,
  email: string,
  origen: string,
  base: string,
  opts: { mandarMail?: boolean } = {}
): Promise<string | null> {
  const mandarMail = opts.mandarMail !== false;
  const filas = (await sql`
    select id, estado, token, confirmacion_enviada_at from newsletter_suscriptores where email = ${email}
  `) as any[];
  const actual = filas[0];
  if (actual?.estado === 'confirmado') return null;

  let token: string;
  if (!actual) {
    token = nuevoToken();
    const ins = (await sql`
      insert into newsletter_suscriptores (email, estado, token, origen, consentimiento_at, confirmacion_enviada_at)
      values (${email}, 'pendiente', ${token}, ${origen}, now(), now())
      on conflict (email) do nothing
      returning id
    `) as any[];
    // Carrera con otro pedido del mismo email: ese ya manda su mail.
    if (!ins.length) return null;
  } else if (actual.estado === 'pendiente') {
    // Sigue pendiente: mismo token (los links de mails anteriores siguen andando).
    token = actual.token;
    if (mandarMail && enFreno(actual.confirmacion_enviada_at)) return linkConfirmar(base, token);
    await sql`
      update newsletter_suscriptores
         set origen = ${origen}, consentimiento_at = now(), confirmacion_enviada_at = now()
       where id = ${actual.id}
    `;
  } else {
    // Se había dado de baja y la vuelve a pedir: nuevo consentimiento, nuevo token.
    token = nuevoToken();
    await sql`
      update newsletter_suscriptores
         set estado = 'pendiente', token = ${token}, origen = ${origen}, consentimiento_at = now(),
             confirmacion_enviada_at = now(), baja_at = null
       where id = ${actual.id}
    `;
  }
  const link = linkConfirmar(base, token);
  if (mandarMail && resendConfigurado()) await mailConfirmacion(email, link);
  return link;
}

/**
 * Link de confirmación de un email que sigue pendiente, para sumarlo a otro mail
 * que igual sale (la confirmación del turno). null si no está pendiente. Nunca lanza.
 */
export async function linkPendiente(sql: any, email: string | null | undefined, base: string): Promise<string | null> {
  const e = normalizarEmail(email);
  if (!e) return null;
  try {
    const r = (await sql`
      select token from newsletter_suscriptores
       where email = ${e} and estado = 'pendiente' and suprimido_at is null
    `) as any[];
    return r[0]?.token ? linkConfirmar(base, r[0].token) : null;
  } catch {
    // Sin tabla todavía o la base no responde: el mail del turno sale igual.
    return null;
  }
}

/**
 * Reenvío manual desde el panel (/admin → Suscriptas) a una que no confirmó.
 * Mismo freno de 10 minutos que la suscripción, para no llenarle la casilla.
 */
export async function reenviarConfirmacion(
  sql: any,
  id: string,
  base: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  if (!resendConfigurado()) return { ok: false, error: 'Los mails no están configurados (falta RESEND_API_KEY).', status: 503 };
  const r = (await sql`
    select email, estado, token, confirmacion_enviada_at from newsletter_suscriptores
     where id = ${id} and suprimido_at is null
  `) as any[];
  const s = r[0];
  if (!s) return { ok: false, error: 'Ya no está en la lista.', status: 404 };
  if (s.estado !== 'pendiente') return { ok: false, error: 'Solo se reenvía a las que están sin confirmar.', status: 409 };
  if (enFreno(s.confirmacion_enviada_at))
    return { ok: false, error: 'Ya se le mandó hace menos de 10 minutos. Probá más tarde.', status: 429 };
  // Se anota antes de mandar: dos toques simultáneos no mandan dos mails.
  const marcado = (await sql`
    update newsletter_suscriptores set confirmacion_enviada_at = now()
     where id = ${id} and estado = 'pendiente'
       and (confirmacion_enviada_at is null or confirmacion_enviada_at < now() - interval '10 minutes')
     returning id
  `) as any[];
  if (!marcado.length) return { ok: false, error: 'Ya se le mandó hace menos de 10 minutos. Probá más tarde.', status: 429 };
  await mailConfirmacion(s.email, linkConfirmar(base, s.token));
  return { ok: true };
}

export const tokenValido = (t: unknown): t is string => typeof t === 'string' && /^[a-f0-9]{32}$/.test(t);

/** Confirma (doble opt-in). Devuelve el estado final, o null si el link no existe. */
export async function confirmar(sql: any, token: string): Promise<'confirmado' | 'baja' | null> {
  const r = (await sql`
    update newsletter_suscriptores set estado = 'confirmado', confirmado_at = now()
     where token = ${token} and estado = 'pendiente'
     returning estado
  `) as any[];
  if (r.length) return 'confirmado';
  const ya = (await sql`select estado from newsletter_suscriptores where token = ${token}`) as any[];
  if (!ya.length) return null;
  return ya[0].estado === 'baja' ? 'baja' : 'confirmado';
}

/** Da de baja. true si el link existe (aunque ya estuviera dada de baja). */
export async function darDeBaja(sql: any, token: string): Promise<boolean> {
  const r = (await sql`
    update newsletter_suscriptores
       set estado = 'baja', baja_at = coalesce(baja_at, now())
     where token = ${token}
     returning id
  `) as any[];
  return r.length > 0;
}

// ---------- Envío del newsletter ----------

/** Mails del newsletter que ya salieron hoy (día de Uruguay, UTC-3). */
async function enviadosHoy(sql: any): Promise<number> {
  const r = (await sql`
    select count(*)::int as n from newsletter_entregas
     where (enviado_at - interval '3 hours')::date = (now() - interval '3 hours')::date
  `) as any[];
  return r[0]?.n ?? 0;
}

export async function cupoHoy(sql: any): Promise<number> {
  return Math.max(0, topeDiario() - (await enviadosHoy(sql)));
}

/**
 * Encabezado para el botón "Cancelar suscripción" de Gmail/Outlook. Va a la
 * página de baja (GET), no a un POST en un clic (RFC 8058): Astro rechaza los
 * POST que no vienen del propio sitio, y apagar esa protección expondría el
 * panel. El one-click solo lo exige Gmail a quien manda más de 5.000 por día.
 */
const headersBaja = (urlBaja: string) => ({ 'List-Unsubscribe': `<${urlBaja}>` });

/** Prueba a un solo email. El link de baja es de mentira (no da de baja a nadie). */
export async function enviarPrueba(o: { to: string; asunto: string; intro?: string | null; entradas: EntradaNl[]; base: string; fotos: FotosEnvio }) {
  await enviarUno({
    to: o.to,
    subject: `[Prueba] ${o.asunto}`,
    html: htmlNewsletter({ ...o, linkBaja: `${o.base}/newsletter/baja?prueba=1` }),
  });
}

/**
 * Manda la tanda que entre en el cupo de hoy, a las suscriptoras confirmadas
 * que todavía no recibieron este envío. Cada lote se anota en
 * newsletter_entregas recién cuando Resend lo aceptó.
 */
export async function enviarTanda(sql: any, envioId: string, base: string) {
  const env = ((await sql`select * from newsletter_envios where id = ${envioId}`) as any[])[0];
  if (!env) throw new Error('El envío no existe');
  const todas = await entradasPublicadas();
  const entradas = (env.entradas as string[])
    .map((s) => todas.find((e) => e.slug === s))
    .filter((e): e is EntradaNl => !!e);
  if (!entradas.length) throw new Error('Las novedades de este envío ya no están publicadas');
  const fotos = leerFotos(env.fotos, entradas.map((e) => e.slug));

  let cupo = await cupoHoy(sql);
  let enviados = 0;
  while (cupo > 0) {
    const n = Math.min(cupo, LOTE_MAX);
    const destinatarias = (await sql`
      select s.id, s.email, s.token from newsletter_suscriptores s
       where s.estado = 'confirmado'
         and not exists (select 1 from newsletter_entregas e where e.envio_id = ${envioId} and e.suscriptor_id = s.id)
       order by s.confirmado_at, s.id
       limit ${n}
    `) as any[];
    if (!destinatarias.length) break;
    const mails = destinatarias.map((d) => {
      const urlBaja = `${base}/newsletter/baja?t=${d.token}`;
      return {
        to: d.email,
        subject: env.asunto,
        html: htmlNewsletter({ intro: env.intro, entradas, base, linkBaja: urlBaja, fotos }),
        headers: headersBaja(urlBaja),
      };
    });
    await enviarLote(mails, `nl-${envioId}-${destinatarias[0].id}-${destinatarias.length}`);
    const ids = destinatarias.map((d) => d.id);
    await sql`
      insert into newsletter_entregas (envio_id, suscriptor_id)
      select ${envioId}, unnest(${ids}::uuid[]) on conflict do nothing
    `;
    enviados += destinatarias.length;
    cupo -= destinatarias.length;
  }
  return { enviados, ...(await estadoEnvio(sql, envioId)) };
}

/** Cuánto falta de un envío, y lo anota en la fila (enviados / terminado). */
export async function estadoEnvio(sql: any, envioId: string) {
  const r = (await sql`
    select
      (select count(*)::int from newsletter_entregas where envio_id = ${envioId}) as hechos,
      (select count(*)::int from newsletter_suscriptores s where s.estado = 'confirmado'
          and not exists (select 1 from newsletter_entregas e where e.envio_id = ${envioId} and e.suscriptor_id = s.id)) as faltan
  `) as any[];
  const { hechos, faltan } = r[0];
  await sql`
    update newsletter_envios
       set enviados = ${hechos}, total = ${hechos + faltan},
           terminado_at = case when ${faltan} = 0 then coalesce(terminado_at, now()) else null end
     where id = ${envioId}
  `;
  return { hechos, faltan };
}
