/**
 * Plantillas del mail del newsletter. HTML de email: tablas, estilos inline y
 * un ancho fijo de 600 px que se achica en el celular. Sin dependencias de
 * Astro, para poder renderizarlas también fuera del sitio (maquetas, pruebas).
 *
 * Tipografía: Fraunces (la de la web) se carga con <link> y solo la muestran
 * Apple Mail / iOS y algunos otros; Gmail y Outlook la ignoran y usan Georgia,
 * que es la de respaldo. Por eso cada plantilla tiene que verse bien con las dos.
 * Las imágenes van siempre por URL pública absoluta.
 */

export const PLANTILLAS = {
  clasica: { nombre: 'Clásica', descripcion: 'Tarjeta clara con foto chica en cada novedad.' },
  editorial: { nombre: 'Editorial', descripcion: 'Foto grande arriba y la primera novedad destacada.' },
  carta: { nombre: 'Carta de Ceci', descripcion: 'Como un mail personal: su foto, su texto y los links.' },
} as const;
export type Plantilla = keyof typeof PLANTILLAS;

export type EntradaMail = {
  titulo: string;
  descripcion: string;
  tipo: string;
  url: string;
  /** URL absoluta de la imagen de la novedad (opcional). */
  imagen?: string | null;
};

export type DatosMail = {
  plantilla: Plantilla;
  /** Texto corto que Gmail muestra al lado del asunto en la bandeja. */
  preheader?: string | null;
  intro?: string | null;
  entradas: EntradaMail[];
  /** Foto de cabecera opcional (URL absoluta). */
  cabecera?: string | null;
  base: string;
  linkBaja: string;
  /** Imágenes de la marca, por URL absoluta. */
  logo: string;
  fotoCeci: string;
};

const C = {
  ink: '#2a302b',
  inkSoft: '#55605a',
  cream: '#faf6f0',
  creamDeep: '#f3ece1',
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

/** Documento completo: <head> con la fuente y los ajustes para celular. */
function documento(cuerpo: string, o: DatosMail, fondo: string) {
  const pre = o.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(o.preheader)}&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>`
    : '';
  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:${fondo}}
  a{color:${C.sageDeep}}
  @media (max-width:620px){
    .w{width:100%!important}
    .px{padding-left:20px!important;padding-right:20px!important}
    .apila{display:block!important;width:100%!important}
    .apila-img{padding:0 0 12px 0!important}
    .apila-img img{width:100%!important;height:auto!important}
    .h1{font-size:28px!important;line-height:34px!important}
  }
</style></head>
<body style="margin:0;padding:0;background:${fondo}">${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${fondo}"><tr><td align="center" style="padding:24px 10px">
${cuerpo}
</td></tr></table></body></html>`;
}

function pie(o: DatosMail, color = C.inkSoft) {
  return `<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0"><tr><td class="px" align="center" style="padding:20px 32px 8px;font-family:${SANS};font-size:12px;line-height:19px;color:${color}">
    Recibís este mail porque te suscribiste a las novedades de ${esc(MARCA)}.<br>
    <a href="${esc(o.linkBaja)}" style="color:${color}">Darme de baja</a> · <a href="${esc(o.base)}/aviso-legal#emails" style="color:${color}">Cómo usamos tu email</a> · Montevideo y San José, Uruguay
  </td></tr></table>`;
}

const avisoConsulta = (o: DatosMail) =>
  `Este contenido es informativo y no reemplaza una consulta. Si querés saber qué le sirve a tu piel, <a href="${esc(o.base)}/reservar" style="color:${C.sageDeep};font-weight:600">reservá tu consulta</a>.`;

const boton = (href: string, texto: string, fondo = C.sage) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:999px;background:${fondo}">
    <a href="${esc(href)}" style="display:inline-block;padding:12px 24px;font-family:${SANS};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:999px">${esc(texto)}</a>
  </td></tr></table>`;

const logoFila = (o: DatosMail, color = C.ink) =>
  `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="padding-right:12px"><img src="${esc(o.logo)}" width="40" height="40" alt="" style="display:block;border:0"></td>
    <td><div style="font-family:${SERIF};font-size:19px;line-height:22px;color:${color}">Cecilia Gutiérrez</div>
      <div style="font-family:${SANS};font-size:10px;line-height:16px;letter-spacing:2px;text-transform:uppercase;color:${C.clayDeep};font-weight:600">Cosmetología Médica</div></td>
  </tr></table>`;

// ---------- Clásica ----------
function clasica(o: DatosMail) {
  const P = `margin:0 0 14px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.ink}`;
  const items = o.entradas
    .map((e) => {
      const img = e.imagen
        ? `<td class="apila apila-img" width="168" valign="top" style="padding:0 20px 0 0"><a href="${esc(e.url)}"><img src="${esc(e.imagen)}" width="168" height="126" alt="" style="display:block;border:0;border-radius:10px;object-fit:cover"></a></td>`
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
  const cab = o.cabecera
    ? `<tr><td><img src="${esc(o.cabecera)}" width="600" alt="" class="w" style="display:block;width:100%;height:auto;border:0;border-radius:18px 18px 0 0"></td></tr>`
    : '';
  return documento(
    `<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" style="background:${C.white};border-radius:18px">
      ${cab}
      <tr><td class="px" style="padding:28px 40px 4px">${logoFila(o)}</td></tr>
      <tr><td class="px" style="padding:20px 40px 8px">${o.intro ? parrafos(o.intro, P) : ''}</td></tr>
      <tr><td class="px" style="padding:0 40px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${items}</table></td></tr>
      <tr><td class="px" style="padding:6px 40px 32px"><p style="margin:0;padding-top:18px;border-top:1px solid ${C.sand};font-family:${SANS};font-size:14px;line-height:22px;color:${C.inkSoft}">${avisoConsulta(o)}</p></td></tr>
    </table>${pie(o)}`,
    o,
    C.cream
  );
}

// ---------- Editorial ----------
function editorial(o: DatosMail) {
  const [prim, ...resto] = o.entradas;
  const P = `margin:0 0 14px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.ink}`;
  const fotoPrim = prim?.imagen || o.cabecera;
  const destacada = prim
    ? `<tr><td style="padding:0">
        ${fotoPrim ? `<a href="${esc(prim.url)}"><img src="${esc(fotoPrim)}" width="600" alt="" class="w" style="display:block;width:100%;height:auto;border:0"></a>` : ''}
      </td></tr>
      <tr><td class="px" style="padding:30px 44px 8px">
        <div style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${C.clayDeep};margin:0 0 10px">${esc(TIPO[prim.tipo] || prim.tipo)} · Destacada</div>
        <a href="${esc(prim.url)}" class="h1" style="font-family:${SERIF};font-size:34px;line-height:40px;color:${C.ink};text-decoration:none">${esc(prim.titulo)}</a>
        <p style="margin:14px 0 20px;font-family:${SANS};font-size:16px;line-height:26px;color:${C.inkSoft}">${esc(prim.descripcion)}</p>
        ${boton(prim.url, leer(prim), C.ink)}
      </td></tr>`
    : '';
  const lista = resto
    .map(
      (e) => `<tr><td class="px" style="padding:0 44px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td valign="top" style="padding:22px 0;border-top:1px solid ${C.sand}">
          <div style="font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.sage};margin:0 0 6px">${esc(TIPO[e.tipo] || e.tipo)}</div>
          <a href="${esc(e.url)}" style="font-family:${SERIF};font-size:21px;line-height:27px;color:${C.ink};text-decoration:none">${esc(e.titulo)}</a>
          <p style="margin:8px 0 8px;font-family:${SANS};font-size:15px;line-height:24px;color:${C.inkSoft}">${esc(e.descripcion)}</p>
          <a href="${esc(e.url)}" style="font-family:${SANS};font-size:15px;font-weight:600;color:${C.clayDeep};text-decoration:none">${leer(e)} &rarr;</a>
        </td>
        ${e.imagen ? `<td width="112" valign="top" style="padding:22px 0 22px 18px;border-top:1px solid ${C.sand}"><a href="${esc(e.url)}"><img src="${esc(e.imagen)}" width="112" height="112" alt="" style="display:block;border:0;border-radius:999px;object-fit:cover"></a></td>` : ''}
      </tr></table></td></tr>`
    )
    .join('');
  return documento(
    `<table role="presentation" class="w" width="600" cellpadding="0" cellspacing="0" border="0" style="background:${C.white}">
      <tr><td class="px" style="padding:22px 44px;background:${C.ink}">${logoFila(o, C.cream)}</td></tr>
      ${o.intro ? `<tr><td class="px" style="padding:26px 44px 6px;background:${C.creamDeep}">${parrafos(o.intro, P)}</td></tr>` : ''}
      ${destacada}
      ${resto.length ? `<tr><td class="px" style="padding:26px 44px 4px"><div style="font-family:${SERIF};font-size:15px;font-style:italic;color:${C.inkSoft}">También esta semana</div></td></tr>` : ''}
      ${lista}
      <tr><td class="px" style="padding:10px 44px 34px"><p style="margin:0;padding-top:18px;border-top:1px solid ${C.sand};font-family:${SANS};font-size:14px;line-height:22px;color:${C.inkSoft}">${avisoConsulta(o)}</p></td></tr>
    </table>${pie(o)}`,
    o,
    C.creamDeep
  );
}

// ---------- Carta de Ceci ----------
function carta(o: DatosMail) {
  const P = `margin:0 0 16px;font-family:${SERIF};font-size:18px;line-height:29px;color:${C.ink}`;
  const links = o.entradas
    .map(
      (e) => `<tr><td valign="top" style="padding:0 12px 16px 0;font-family:${SERIF};font-size:18px;line-height:28px;color:${C.clay}">&bull;</td>
        <td style="padding:0 0 16px"><a href="${esc(e.url)}" style="font-family:${SERIF};font-size:18px;line-height:28px;color:${C.sageDeep};font-weight:600">${esc(e.titulo)}</a>
          <div style="font-family:${SANS};font-size:14px;line-height:22px;color:${C.inkSoft};margin-top:2px">${esc(e.descripcion)}</div></td></tr>`
    )
    .join('');
  const intro = o.intro || 'Te dejo lo que estuve leyendo y escribiendo estas semanas, por si te sirve para tu piel.';
  return documento(
    `<table role="presentation" class="w" width="560" cellpadding="0" cellspacing="0" border="0" style="background:${C.white};border:1px solid ${C.sand};border-radius:10px">
      ${o.cabecera ? `<tr><td><img src="${esc(o.cabecera)}" width="560" alt="" class="w" style="display:block;width:100%;height:auto;border:0;border-radius:10px 10px 0 0"></td></tr>` : ''}
      <tr><td class="px" style="padding:36px 44px 8px">
        <p style="margin:0 0 20px;font-family:${SANS};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:${C.clayDeep};font-weight:600">Novedades de Ceci</p>
        ${parrafos(intro, P)}
      </td></tr>
      <tr><td class="px" style="padding:4px 44px 6px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${links}</table></td></tr>
      <tr><td class="px" style="padding:8px 44px 34px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:14px"><img src="${esc(o.fotoCeci)}" width="56" height="56" alt="Ceci" style="display:block;border:0;border-radius:999px"></td>
          <td><div style="font-family:${SERIF};font-size:20px;font-style:italic;color:${C.ink}">Ceci</div>
            <div style="font-family:${SANS};font-size:13px;line-height:19px;color:${C.inkSoft}">Cecilia Gutiérrez · Cosmetología Médica</div></td>
        </tr></table>
        <p style="margin:22px 0 0;font-family:${SANS};font-size:13px;line-height:20px;color:${C.inkSoft}">${avisoConsulta(o)}</p>
      </td></tr>
    </table>${pie(o)}`,
    o,
    C.cream
  );
}

export function renderNewsletter(o: DatosMail): string {
  if (o.plantilla === 'editorial') return editorial(o);
  if (o.plantilla === 'carta') return carta(o);
  return clasica(o);
}
