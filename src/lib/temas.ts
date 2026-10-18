/**
 * Agenda de temas para las novedades: lo que propone el research de los lunes
 * y lo que anota Ceci a mano. Vive en Neon (tabla agenda_temas); las entradas
 * del blog siguen siendo los .md del repo (ver src/lib/novedades.ts).
 */

import { getCollection } from 'astro:content';
import { esc, remitente } from './email';
import { investigar, type TemaPropuesto } from './research';

export const ESTADOS = ['idea', 'elegido', 'publicado', 'descartado'] as const;
export type Estado = (typeof ESTADOS)[number];

export async function listarTemas(sql: any) {
  return (await sql`
    select id, titulo, resumen, angulo, tipo, fuentes, evidencia, estado, origen, slug,
           created_at, updated_at
      from agenda_temas
     where estado in ('idea','elegido')
        or updated_at > now() - interval '60 days'
     order by case estado when 'elegido' then 0 when 'idea' then 1 when 'publicado' then 2 else 3 end,
              created_at desc
     limit 200
  `) as any[];
}

/** Títulos que el research no debe repetir: lo publicado y lo que ya está en la agenda. */
async function temasCubiertos(sql: any): Promise<string[]> {
  const blog = await getCollection('blog').catch(() => []);
  const agenda = (await sql`
    select titulo from agenda_temas where created_at > now() - interval '180 days' order by created_at desc limit 120
  `) as any[];
  return [...blog.map((e) => e.data.titulo), ...agenda.map((t) => t.titulo)];
}

/**
 * Corre el research y guarda los temas como ideas. Le avisa a Ceci por mail si
 * hay temas nuevos. Devuelve cuántos se agregaron.
 */
export async function researchSemanal(sql: any, base: string): Promise<TemaPropuesto[]> {
  const temas = await investigar(await temasCubiertos(sql));
  for (const t of temas) {
    await sql`
      insert into agenda_temas (titulo, resumen, angulo, tipo, fuentes, evidencia, estado, origen)
      values (${t.titulo}, ${t.resumen}, ${t.angulo}, ${t.tipo}, ${JSON.stringify(t.fuentes)}::jsonb,
              ${t.evidencia}, 'idea', 'research')
    `;
  }
  if (temas.length) await avisarCeci(temas, base);
  return temas;
}

const EVIDENCIA: Record<string, string> = {
  solida: 'Evidencia sólida',
  emergente: 'Evidencia emergente',
  moda: 'Moda sin evidencia suficiente',
};

/** Mail a Ceci con los temas de la semana. Nunca lanza error. */
async function avisarCeci(temas: TemaPropuesto[], base: string) {
  try {
    const key = process.env.RESEND_API_KEY;
    const ceci = process.env.CECI_NOTIF_EMAIL;
    if (!key || !ceci) return;
    const P = 'font-family:system-ui,sans-serif;line-height:1.6;color:#2a302b';
    const items = temas
      .map(
        (t) => `<div style="border-top:1px solid #e4e0d8;padding:14px 0">
          <p style="${P};font-size:12px;color:#55605a;margin:0 0 4px">${esc(t.tipo)} · ${esc(EVIDENCIA[t.evidencia] ?? t.evidencia)}</p>
          <p style="font-family:Georgia,serif;font-size:17px;color:#2a302b;margin:0 0 6px">${esc(t.titulo)}</p>
          <p style="${P};margin:0 0 6px">${esc(t.resumen)}</p>
          <p style="${P};margin:0 0 6px"><em>Ángulo:</em> ${esc(t.angulo)}</p>
          ${t.fuentes.map((f) => `<a href="${esc(f.url)}" style="${P};font-size:13px;color:#5d7a63;display:block">${esc(f.titulo || f.url)}</a>`).join('')}
        </div>`
      )
      .join('');
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: remitente(),
        to: ceci,
        subject: `🗞️ ${temas.length} temas para tus novedades de esta semana`,
        html: `<h2 style="font-family:Georgia,serif;color:#2a302b">Temas de la semana</h2>
          <p style="${P}">El research de los lunes encontró estos temas. Están en tu panel, en Novedades → Agenda de temas: elegí los que quieras escribir y descartá el resto.</p>
          ${items}
          <p style="${P};margin-top:16px"><a href="${esc(base)}/admin" style="color:#5d7a63;font-weight:600">Abrir el panel</a></p>
          <p style="${P};font-size:13px;color:#55605a">Son propuestas de una IA: revisá las fuentes antes de escribir, y escribí siempre con tu criterio. Sin prometer curas ni resultados garantizados.</p>`,
      }),
    });
  } catch {
    /* el aviso no debe tirar abajo el research */
  }
}
