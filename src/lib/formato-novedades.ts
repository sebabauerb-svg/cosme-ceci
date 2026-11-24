/**
 * Le da forma a cómo escribe Ceci sus novedades, sin pedirle que cambie nada:
 * los .md siguen igual y esto transforma el texto antes de pasarlo a HTML.
 *
 *  - Línea corta que arranca con un emoji ("🔬 La anatomía del problema: …")
 *    → subtítulo de sección, con el emoji en un círculo.
 *  - Si ese emoji es 💡 → la sección va en un recuadro de tip;
 *    si es 🚨 / ⚠️ / ❗ → recuadro de alerta (hasta el próximo subtítulo).
 *  - Párrafos que empiezan con 🔴 (o 🟠 🟡 🟢 ✅ ❌) → lista de señales.
 *  - "Etiqueta corta: texto…" (párrafos e ítems de lista) → etiqueta en negrita.
 *  - El primer párrafo → entrada destacada.
 *  - La firma del final ("Cecilia Gutiérrez / Cosmetología Médica…") se quita:
 *    la página muestra su tarjeta de autora.
 *  - Restos de fórmulas tipo "$0.05\text{ mm}$" → "0.05 mm".
 *
 * Los recuadros se arman con <div> y una línea en blanco adentro, que en
 * Markdown permite seguir escribiendo Markdown dentro del bloque.
 */

const EMOJI = /^((?:\p{Extended_Pictographic}|\p{Regional_Indicator})(?:️|‍\p{Extended_Pictographic}️?)*)\s*/u;
const VINETA = /^(🔴|🟠|🟡|🟢|✅|❌|▪️|•)\s*/u;
const TIP = new Set(['💡']);
const ALERTA = new Set(['🚨', '⚠️', '⚠', '❗']);

const escHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

/** "$0.05\text{ mm}$" → "0.05 mm". */
const limpiarFormulas = (s: string) =>
  s.replace(/\$([^$\n]{1,60})\$/g, (_, f: string) =>
    f.replace(/\\text\{([^}]*)\}/g, '$1').replace(/\\[a-zA-Z]+/g, '').replace(/[{}]/g, '').replace(/\s+/g, ' ').trim()
  );

/** "Etiqueta corta: texto" → "**Etiqueta corta:** texto" (si la etiqueta no trae ya formato). */
const etiqueta = (linea: string) => {
  const m = linea.match(/^((?:\d+\.|[-*])\s+)?([^:.!?¿¡*_`\n]{3,55}):\s+(?=\S)/);
  if (!m) return linea;
  return `${m[1] ?? ''}**${m[2].trim()}:** ${linea.slice(m[0].length)}`;
};

const caja = (clase: string, md: string) => `<div class="${clase}">\n\n${md}\n\n</div>`;

type Bloque = { tipo: 'h'; emoji: string; texto: string; caja: 'tip' | 'alerta' | null } | { tipo: 'md'; texto: string };

export function formatearNovedad(md: string): string {
  const fuente = limpiarFormulas(md.replace(/\r\n/g, '\n')).trim();

  // 1) Bloques separados por línea en blanco. Un bloque que arranca con una
  //    línea corta con emoji se parte en título + resto.
  const crudos = fuente.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  const bloques: Bloque[] = [];
  for (const b of crudos) {
    const [primera, ...resto] = b.split('\n');
    const em = primera.trim().match(EMOJI);
    if (em && !VINETA.test(primera.trim()) && primera.trim().length <= 120) {
      const emoji = em[1];
      bloques.push({
        tipo: 'h',
        emoji,
        texto: primera.trim().slice(em[0].length).trim(),
        caja: TIP.has(emoji) ? 'tip' : ALERTA.has(emoji) ? 'alerta' : null,
      });
      if (resto.join('\n').trim()) bloques.push({ tipo: 'md', texto: resto.join('\n').trim() });
    } else {
      bloques.push({ tipo: 'md', texto: b });
    }
  }

  // 2) Cada bloque a Markdown/HTML.
  const salida: string[] = [];
  let lede = true;
  let abierta = false; // hay un recuadro de tip/alerta abierto
  let enCaja = 0; // bloques de contenido dentro del recuadro abierto
  const cerrar = () => {
    if (abierta) salida.push('</div>');
    abierta = false;
    enCaja = 0;
  };

  for (let i = 0; i < bloques.length; i++) {
    const b = bloques[i];

    if (b.tipo === 'h') {
      cerrar();
      lede = false;
      const h = `<h2 class="nv-h${b.caja ? ` nv-h--${b.caja}` : ''}" data-emoji="${escHtml(b.emoji)}">${escHtml(b.texto)}</h2>`;
      if (b.caja) {
        salida.push(`<div class="nv-caja nv-caja--${b.caja}">\n\n${h}\n`);
        abierta = true;
      } else {
        salida.push(h);
      }
      continue;
    }

    const t = b.texto;

    // Firma al final: la reemplaza la tarjeta de autora.
    if (/^Cecilia Guti[ée]rrez\b/.test(t) && t.length < 90) continue;

    // Fin de un recuadro: una línea que arranca con emoji (ej. "🗓 Agenda…") o un
    // párrafo corto de cierre ("Cuidar la piel es…") cuando ya hubo contenido.
    if (abierta && !VINETA.test(t) && !/^(\d+\.|[-*])\s/.test(t)) {
      const conEmoji = EMOJI.test(t);
      const cierreCorto = enCaja > 0 && t.length <= 140 && !t.trimEnd().endsWith(':') && etiqueta(t) === t;
      if (conEmoji || cierreCorto) cerrar();
    }
    if (abierta) enCaja++;

    // Viñetas con emoji (bloques seguidos o líneas del mismo bloque) → una lista.
    if (VINETA.test(t)) {
      const items: string[] = [];
      while (i < bloques.length) {
        const x = bloques[i];
        if (x.tipo !== 'md' || !VINETA.test(x.texto)) break;
        for (const l of x.texto.split('\n')) if (l.trim()) items.push(`- ${etiqueta(l.trim().replace(VINETA, ''))}`);
        i++;
      }
      i--;
      salida.push(caja('nv-senales', items.join('\n')));
      lede = false;
      continue;
    }

    // Listas numeradas o con guiones: etiqueta en negrita en cada ítem.
    if (/^(\d+\.|[-*])\s/.test(t)) {
      salida.push(t.split('\n').map((l) => etiqueta(l)).join('\n'));
      lede = false;
      continue;
    }

    if (lede) {
      salida.push(caja('nv-lede', t));
      lede = false;
      continue;
    }

    const conEtiqueta = etiqueta(t);
    salida.push(conEtiqueta !== t ? caja('nv-paso', conEtiqueta) : t);
  }
  cerrar();
  return salida.join('\n\n');
}

// El mismo procesador de Markdown que usa Astro (Sätteri), creado una sola vez.
let procesador: Promise<{ render: (md: string) => Promise<{ code: string }> }> | null = null;

/** HTML de una novedad: formatea el texto de Ceci y lo pasa por el procesador de Astro. */
export async function htmlDeNovedad(md: string): Promise<string> {
  if (!procesador) {
    procesador = import('@astrojs/markdown-satteri').then((m) => m.createSatteriMarkdownProcessor({}));
  }
  const { code } = await (await procesador).render(formatearNovedad(md));
  return code;
}
