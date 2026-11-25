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
import { renderBienvenida, renderNewsletter } from './plantillas-newsletter';
import {
  CABECERA_POR_DEFECTO,
  RUTA_FIRMA,
  RUTA_LOGO,
  absoluta,
  fotoFija,
  fotoSubida,
  rutaCabecera,
  rutaFoto,
  type FotoRef,
} from '../data/galeria-newsletter';
import { refsDisponibles } from './fotos';

/**
 * Base de las imágenes del mail. Siempre el dominio público: los previews de
 * Vercel piden login y Gmail no podría bajarlas. En un preview, las fotos
 * fijas nuevas recién se ven después del merge. Las que sube Ceci ya vienen con
 * su dirección absoluta en Blob y se ven siempre.
 */
const baseImagenes = () => (process.env.PUBLIC_SITE_URL || 'https://cgcosmetologiamedica.com').replace(/\/+$/, '');

export const MAX_ENTRADAS = 3;
/** Resend acepta hasta 100 mails por llamada a /emails/batch. */
const LOTE_MAX = 100;
/** No mandar la bienvenida al mismo email más seguido que esto (evita spam a terceros). */
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

/** Bienvenida al suscribirse, con la estética del newsletter (foto, logo y firma). */
export function htmlBienvenida(base: string, linkBaja: string) {
  const img = baseImagenes();
  return renderBienvenida({
    preheader: 'Gracias por sumarte a las novedades de Ceci',
    cabecera: img + rutaCabecera(CABECERA_POR_DEFECTO),
    base,
    linkBaja,
    logo: img + RUTA_LOGO,
    fotoCeci: img + RUTA_FIRMA,
  });
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
export type FotosEnvio = { cabecera: FotoRef; porEntrada: Record<string, FotoRef> };


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
        imagen: foto ? absoluta(rutaFoto(foto), img) : null,
      };
    }),
    cabecera: absoluta(rutaCabecera(o.fotos.cabecera), img),
    base: o.base,
    linkBaja: o.linkBaja,
    logo: img + RUTA_LOGO,
    fotoCeci: img + RUTA_FIRMA,
  });
}

/**
 * Lee y valida las fotos que manda el panel (o las guardadas en un envío).
 * `subidas`: las fotos de Ceci que se pueden usar (ver refsDisponibles). Si
 * una ya no está (la borró), la cabecera vuelve a la de por defecto y la
 * novedad queda sin foto, como si no hubiera elegido.
 */
export function leerFotos(v: any, slugs: string[], subidas: Set<string>): FotosEnvio {
  const ok = (f: unknown): f is FotoRef => fotoFija(f) || (fotoSubida(f) && subidas.has(f));
  const cabecera = ok(v?.cabecera) ? v.cabecera : CABECERA_POR_DEFECTO;
  const porEntrada: Record<string, FotoRef> = {};
  for (const s of slugs) if (ok(v?.porEntrada?.[s])) porEntrada[s] = v.porEntrada[s];
  return { cabecera, porEntrada };
}

// ---------- Suscripción ----------

const nuevoToken = () => crypto.randomBytes(16).toString('hex');

/**
 * Suscribe un email (alta directa, sin mail de confirmación: lo decidió Sebas
 * en oct-2026). El consentimiento es la casilla que la persona marca; queda
 * registrado con fecha y origen. Le llega un mail de bienvenida con el link de
 * baja, así que si alguien anota un email ajeno, la persona se entera y se baja
 * con un clic. Siempre responde igual hacia afuera (no revela si ya estaba).
 * Si ya estaba suscripta, no hace nada.
 */
export async function pedirSuscripcion(sql: any, email: string, origen: string, base: string) {
  const filas = (await sql`
    select id, estado, confirmacion_enviada_at from newsletter_suscriptores where email = ${email}
  `) as any[];
  const actual = filas[0];
  if (actual?.estado === 'confirmado') return;

  // Vuelve a anotarse (o se había dado de baja): nuevo consentimiento, nuevo token.
  const token = nuevoToken();
  if (!actual) {
    await sql`
      insert into newsletter_suscriptores (email, estado, token, origen, consentimiento_at, confirmado_at, confirmacion_enviada_at)
      values (${email}, 'confirmado', ${token}, ${origen}, now(), now(), now())
      on conflict (email) do nothing
    `;
  } else {
    await sql`
      update newsletter_suscriptores
         set estado = 'confirmado', token = ${token}, origen = ${origen}, consentimiento_at = now(),
             confirmado_at = now(), confirmacion_enviada_at = now(), baja_at = null
       where id = ${actual.id}
    `;
  }
  // Freno para no mandar bienvenidas seguidas al mismo email (alta, baja, alta…).
  const reciente =
    actual?.confirmacion_enviada_at && Date.now() - new Date(actual.confirmacion_enviada_at).getTime() < REENVIO_MIN_MS;
  if (reciente || !resendConfigurado()) return;
  await enviarUno({
    to: email,
    subject: `Ya estás en la lista de novedades — ${MARCA}`,
    html: htmlBienvenida(base, `${base}/newsletter/baja?t=${token}`),
    headers: { 'List-Unsubscribe': `<${base}/newsletter/baja?t=${token}>` },
  });
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
  const fotos = leerFotos(env.fotos, entradas.map((e) => e.slug), await refsDisponibles(sql, { conservadas: true }));

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
