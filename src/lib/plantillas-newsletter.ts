/**
 * Plantilla del mail del newsletter: la "Clásica" con la firma y el tono
 * personal de la "Carta de Ceci" (lo que eligieron Sebas y Ceci en oct-2026).
 * HTML de email: tablas, estilos inline y 600 px de ancho que se apilan en el
 * celular. Sin dependencias de Astro, para poder renderizarla fuera del sitio.
 *
 * Tipografía: Fraunces (la de la web) se carga con <link> y solo la muestran
 * Apple Mail / iOS y algunos otros; Gmail y Outlook usan Georgia de respaldo.
 * Las imágenes van siempre por URL pública absoluta.
 */

export type EntradaMail = {
  titulo: string;
  descripcion: string;
  tipo: string;
  url: string;
  /** URL absoluta de la foto de la novedad (opcional). */
  imagen?: string | null;
};

export type DatosMail = {
  /** Texto corto que la bandeja muestra al lado del asunto. */
  preheader?: string | null;
  intro?: string | null;
  entradas: EntradaMail[];
  /** Foto de cabecera (URL absoluta). Siempre va una. */
  cabecera: string;
  /** URL del sitio para los links (reservar, aviso legal). */
  base: string;
  linkBaja: string;
  logo: string;
  fotoCeci: string;
};

const C = {
  ink: '#2a302b',
  inkSoft: '#55605a',
  cream: '#faf6f0',
  sand: '#e7dccd',
  sage: '#6e7f6a',
  sageDeep: '#4f5d4c',
  clay: '#c0805f',
  clayDeep: '#a76a4b',
  white: '#ffffff',
};
const SERIF = "'Fraunces', Georgia, 'Times New Roman', serif";
const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MARCA = 'Cecilia Gutiérrez · Cosmetología Médica';
const TIPO: Record<string, string> = { novedad: 'Novedad', tip: 'Tip', nota: 'Nota' };

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const parrafos = (t: string, estilo: string) =>
  t
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${estilo}">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');

const leer = (e: EntradaMail) => (e.tipo === 'nota' ? 'Leer la nota' : 'Leer');

/** Lo que comparten todos los mails de la lista: fotos, logo, firma y la baja. */
export type MarcoMail = Pick<DatosMail, 'preheader' | 'cabecera' | 'base' | 'linkBaja' | 'logo' | 'fotoCeci'>;

/**
 * Marco común: foto de arriba, logo, el contenido, la firma de Ceci, un cierre
 * y el pie con la baja. Lo usan el newsletter y el mail de bienvenida.
 */
function marcoMail(o: MarcoMail, contenido: string, cierre: string): string {
  const pre = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`
    : '';
  return `<!doctype html>
<html lang="es" xml:lang="es"><head><meta charset="utf-8"><meta http-equiv="Content-Language" content="es"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:${C.cream}}
  @media (max-width:620px){
    .w{width:100%!important}
    .px{padding-left:20px!important;padding-right:20px!important}
    .apila{display:block!important;width:100%!important}
    .apila-img{padding:0 0 12px 0!important}
    .apila-img img{width:100%!important;height:auto!important}
  }
</style></head>
<body lang="es" style="margin:0;padding:0;background:${C.cream}"><div lang="es" dir="ltr">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.cream}"><tr><td align="center" style="padding:24px 10px">
<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" style="background:${C.white};border-radius:18px">
  <tr><td><img src="${esc(o.cabecera)}" width="600" alt="" class="w" style="display:block;width:100%;height:auto;border:0;border-radius:18px 18px 0 0"></td></tr>
  <tr><td class="px" style="padding:26px 40px 4px">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="padding-right:12px"><img src="${esc(o.logo)}" width="40" height="40" alt="" style="display:block;border:0"></td>
      <td><div style="font-family:${SERIF};font-size:19px;line-height:22px;color:${C.ink}">Cecilia Gutiérrez</div>
        <div style="font-family:${SANS};font-size:10px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${C.clayDeep};font-weight:600">Cosmetología Médica</div></td>
    </tr></table>
  </td></tr>
  ${contenido}
  <tr><td class="px" style="padding:4px 40px 0">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:22px 0 0;border-top:1px solid ${C.sand}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding-right:14px"><img src="${esc(o.fotoCeci)}" width="56" height="56" alt="Ceci" style="display:block;border:0;border-radius:999px"></td>
        <td><div style="font-family:${SERIF};font-size:20px;font-style:italic;color:${C.ink}">Ceci</div>
          <div style="font-family:${SANS};font-size:13px;line-height:19px;color:${C.inkSoft}">${esc(MARCA)}</div></td>
      </tr></table>
    </td></tr></table>
  </td></tr>
  <tr><td class="px" style="padding:20px 40px 32px"><p style="margin:0;font-family:${SANS};font-size:14px;line-height:22px;color:${C.inkSoft}">${cierre}</p></td></tr>
</table>
<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" align="center" style="padding:20px 32px 8px;font-family:${SANS};font-size:12px;line-height:19px;color:${C.inkSoft}">
  Recibís este mail porque te suscribiste a las novedades de ${esc(MARCA)}.<br>
  <a href="${esc(o.linkBaja)}" style="color:${C.inkSoft}">Darme de baja</a> · <a href="${esc(o.base)}/aviso-legal#emails" style="color:${C.inkSoft}">Cómo usamos tu email</a> · Montevideo y San José, Uruguay
</td></tr></table>
</td></tr></table></div></body></html>`;
}

export function renderNewsletter(o: DatosMail): string {
  const INTRO = `margin:0 0 16px;font-family:${SERIF};font-size:18px;line-height:29px;color:${C.ink}`;
  const items = o.entradas
    .map((e) => {
      const img = e.imagen
        ? `<td class="apila apila-img" width="168" valign="top" style="padding:0 20px 0 0"><a href="${esc(e.url)}"><img src="${esc(e.imagen)}" width="168" height="126" alt="" style="display:block;border:0;border-radius:10px"></a></td>`
        : '';
      return `<tr><td style="padding:22px 0;border-top:1px solid ${C.sand}">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>${img}
          <td class="apila" valign="top">
            <div style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.sage};margin:0 0 6px">${esc(TIPO[e.tipo] || e.tipo)}</div>
            <a href="${esc(e.url)}" style="font-family:${SERIF};font-size:21px;line-height:27px;color:${C.ink};text-decoration:none">${esc(e.titulo)}</a>
            <p style="margin:8px 0 10px;font-family:${SANS};font-size:15px;line-height:24px;color:${C.inkSoft}">${esc(e.descripcion)}</p>
            <a href="${esc(e.url)}" style="font-family:${SANS};font-size:15px;font-weight:600;color:${C.clayDeep};text-decoration:none">${leer(e)} &rarr;</a>
          </td></tr></table>
      </td></tr>`;
    })
    .join('');
  return marcoMail(
    o,
    `${o.intro ? `<tr><td class="px" style="padding:22px 40px 6px">${parrafos(o.intro, INTRO)}</td></tr>` : ''}
  <tr><td class="px" style="padding:${o.intro ? '0' : '16px'} 40px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table></td></tr>`,
    `Este contenido es informativo y no reemplaza una consulta. Si querés saber qué le sirve a tu piel, <a href="${esc(o.base)}/reservar" style="color:${C.sageDeep};font-weight:600">reservá tu consulta</a>.`
  );
}

/** Bienvenida al suscribirse, con la misma estética que el newsletter. */
export function renderBienvenida(o: MarcoMail): string {
  const fila = (titulo: string, texto: string) =>
    `<tr><td valign="top" style="padding:0 12px 12px 0;font-family:${SERIF};font-size:18px;line-height:24px;color:${C.clay}">&bull;</td>
      <td style="padding:0 0 12px;font-family:${SANS};font-size:15px;line-height:24px;color:${C.inkSoft}"><strong style="color:${C.ink}">${titulo}</strong> ${texto}</td></tr>`;
  return marcoMail(
    o,
    `<tr><td class="px" style="padding:24px 40px 8px">
      <h1 style="margin:0 0 14px;font-family:${SERIF};font-size:30px;line-height:36px;font-weight:600;color:${C.ink}">¡Ya estás en la lista!</h1>
      <p style="margin:0 0 18px;font-family:${SERIF};font-size:18px;line-height:29px;color:${C.ink}">Gracias por sumarte. Desde ahora te llegan por email las novedades del consultorio, solo cuando haya algo nuevo.</p>
      <p style="margin:0 0 12px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.ink}">Esto es lo que vas a recibir:</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        ${fila('Novedades:', 'tendencias y temas del momento, mirados con criterio.')}
        ${fila('Tips:', 'recomendaciones prácticas para tu rutina.')}
        ${fila('Notas:', 'artículos más largos para entender mejor tu piel.')}
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:10px 0 22px"><tr><td style="border-radius:999px;background:${C.sage}">
        <a href="${esc(o.base)}/blog" style="display:inline-block;padding:12px 24px;font-family:${SANS};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">Ver las novedades</a>
      </td></tr></table>
    </td></tr>`,
    `Si no te anotaste vos, o cambiás de idea, podés <a href="${esc(o.linkBaja)}" style="color:${C.sageDeep};font-weight:600">darte de baja con un clic</a>. Cada mail trae ese mismo link.`
  );
}
