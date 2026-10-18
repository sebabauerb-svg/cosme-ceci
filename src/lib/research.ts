/**
 * Research semanal de novedades (lo dispara el cron de los lunes, o Ceci con
 * "Investigar ahora" en el panel). Claude busca en la web qué se está hablando
 * en cosmetología y skincare, y propone de 5 a 8 temas con fuentes para la
 * agenda de novedades. NO escribe ni publica artículos: propone temas, y Ceci
 * elige y escribe con su criterio (la responsabilidad del contenido es de ella).
 *
 * Cómo sale la lista: por una herramienta propia con `strict: true`
 * (guardar_temas). No se usa `output_config.format` porque la búsqueda web
 * devuelve citas y las dos cosas juntas dan error 400.
 *
 * Variables: ANTHROPIC_API_KEY (sin ella, el research no corre).
 * Costo aproximado por corrida: 0,30 a 0,60 USD (búsquedas + tokens).
 */

import Anthropic from '@anthropic-ai/sdk';

export const researchConfigurado = () => !!process.env.ANTHROPIC_API_KEY;

const MODELO = 'claude-opus-5-5';

export type TemaPropuesto = {
  titulo: string;
  resumen: string;
  angulo: string;
  tipo: 'novedad' | 'tip' | 'nota';
  evidencia: 'solida' | 'emergente' | 'moda';
  fuentes: { titulo: string; url: string }[];
};

/** Estación en Uruguay (hemisferio sur) para orientar temas de temporada. */
function estacionUY(d = new Date()) {
  const m = d.getUTCMonth() + 1;
  if (m >= 3 && m <= 5) return 'otoño';
  if (m >= 6 && m <= 8) return 'invierno';
  if (m >= 9 && m <= 11) return 'primavera';
  return 'verano';
}

/**
 * Las instrucciones del research. Es el mismo texto que queda en
 * RESEARCH-NOVEDADES.md como prompt de respaldo para usar en otra IA.
 */
export const INSTRUCCIONES = `Sos el asistente editorial de Cecilia Gutiérrez, cosmetóloga médica con consultorio en Montevideo y San José (Uruguay). Ella publica en su web entradas cortas para sus pacientes: novedades (tendencias o noticias del momento), tips (recomendaciones prácticas) y notas (artículos más largos).

Tu tarea de cada semana: investigar en la web qué hay de nuevo A NIVEL MUNDIAL en cosmetología, skincare, cuidado de la piel, activos cosméticos, tecnologías estéticas no invasivas (por ejemplo radiofrecuencia, IPL, microneedling), cuidado capilar y corporal, regulación de cosméticos y protección solar, y proponerle temas para escribir.

Cómo investigar:
- Priorizá lo publicado en los últimos 7 a 14 días.
- Fuentes confiables primero: revistas de dermatología y cosmetología (JAAD, British Journal of Dermatology, JEADV, Journal of Cosmetic Dermatology, International Journal of Cosmetic Science), asociaciones (AAD, EADV, sociedades latinoamericanas de dermatología), reguladores (FDA, EMA, SCCS de la Unión Europea, ANMAT, MSP de Uruguay) y medios especializados serios (Dermatology Times, Cosmetics Design, Allure, Byrdie, revistas de la industria).
- Mirá también las tendencias virales (TikTok, Instagram), pero evaluálas con criterio: si algo es moda sin evidencia, el tema vale igual, con el ángulo de explicarlo con los pies en la tierra.
- Sumá lo regional cuando haya algo (Uruguay, Argentina, Latinoamérica) y lo de temporada.

Qué proponer: de 5 a 8 temas variados (no todos del mismo tipo ni de la misma fuente). Para cada uno:
- titulo: un título de trabajo claro, en español rioplatense.
- resumen: 2 o 3 frases sobre qué pasó o de qué se está hablando.
- angulo: cómo lo contaría Ceci a sus pacientes, en una o dos frases. Su voz es profesional, cercana y con criterio: explica, ordena y aterriza las modas.
- tipo: novedad, tip o nota.
- evidencia: "solida" (respaldo científico consistente), "emergente" (estudios iniciales o prometedores) o "moda" (tendencia sin evidencia suficiente).
- fuentes: de 1 a 3 fuentes que hayas visto en la búsqueda, con su título y su URL exacta. Nunca inventes una URL.

Límites (obligatorios):
- Nada de prometer curas ni resultados garantizados, ni cifras sin fuente.
- Nada de precios de tratamientos.
- No propongas recomendar medicamentos de venta bajo receta; si un tema roza lo médico (acné severo, rosácea, melasma, lunares), el ángulo incluye cuándo consultar a un médico dermatólogo.
- No repitas temas que ya estén en la lista de "temas ya cubiertos".

Cuando termines de investigar, llamá UNA sola vez a la herramienta guardar_temas con la lista completa.`;

const herramientaGuardar = {
  name: 'guardar_temas',
  description: 'Guarda en la agenda de Ceci los temas propuestos de esta semana. Llamala una sola vez, al final, con todos los temas.',
  strict: true,
  input_schema: {
    type: 'object' as const,
    properties: {
      temas: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            titulo: { type: 'string' },
            resumen: { type: 'string' },
            angulo: { type: 'string' },
            tipo: { type: 'string', enum: ['novedad', 'tip', 'nota'] },
            evidencia: { type: 'string', enum: ['solida', 'emergente', 'moda'] },
            fuentes: {
              type: 'array',
              items: {
                type: 'object',
                properties: { titulo: { type: 'string' }, url: { type: 'string' } },
                required: ['titulo', 'url'],
                additionalProperties: false,
              },
            },
          },
          required: ['titulo', 'resumen', 'angulo', 'tipo', 'evidencia', 'fuentes'],
          additionalProperties: false,
        },
      },
    },
    required: ['temas'],
    additionalProperties: false,
  },
};

const recortar = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().replace(/\s+/g, ' ').slice(0, max) : '');

/** Valida y limpia lo que devolvió el modelo (URLs http/https, largos, enums). */
function limpiar(input: any): TemaPropuesto[] {
  const temas: any[] = Array.isArray(input?.temas) ? input.temas : [];
  return temas
    .map((t) => ({
      titulo: recortar(t?.titulo, 160),
      resumen: recortar(t?.resumen, 700),
      angulo: recortar(t?.angulo, 500),
      tipo: ['novedad', 'tip', 'nota'].includes(t?.tipo) ? t.tipo : 'novedad',
      evidencia: ['solida', 'emergente', 'moda'].includes(t?.evidencia) ? t.evidencia : 'emergente',
      fuentes: (Array.isArray(t?.fuentes) ? t.fuentes : [])
        .map((f: any) => ({ titulo: recortar(f?.titulo, 200), url: recortar(f?.url, 600) }))
        .filter((f: { url: string }) => /^https?:\/\/[^\s]+$/i.test(f.url))
        .slice(0, 3),
    }))
    .filter((t) => t.titulo && t.resumen)
    .slice(0, 10);
}

/**
 * Corre el research. `cubiertos`: títulos ya publicados o ya en la agenda, para
 * que no se repitan. Devuelve los temas validados.
 */
export async function investigar(cubiertos: string[]): Promise<TemaPropuesto[]> {
  const client = new Anthropic();
  const hoy = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: `Hoy es ${hoy} y en Uruguay es ${estacionUY()}.

Temas ya cubiertos (no los repitas):
${cubiertos.length ? cubiertos.map((t) => `- ${t}`).join('\n') : '- (todavía ninguno)'}

Investigá las novedades de esta semana y guardá los temas con guardar_temas.`,
    },
  ];

  // Bucle corto: la búsqueda web corre del lado de Anthropic y puede pausar el
  // turno (pause_turn); se reanuda reenviando lo que vino, sin mensajes nuevos.
  let pedidoGuardar = false;
  for (let vuelta = 0; vuelta < 6; vuelta++) {
    const resp = await client.beta.messages
      .stream({
        model: MODELO,
        max_tokens: 32000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium' },
        system: INSTRUCCIONES,
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }, herramientaGuardar],
        messages,
      })
      .finalMessage();

    if (resp.stop_reason === 'refusal') {
      throw new Error(`El modelo no completó el research (${resp.stop_details?.category ?? 'sin detalle'}).`);
    }
    const guardar = resp.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use' && b.name === 'guardar_temas'
    );
    if (guardar) return limpiar(guardar.input);

    messages.push({ role: 'assistant', content: resp.content });
    if (resp.stop_reason === 'pause_turn') continue;
    if (resp.stop_reason === 'max_tokens') throw new Error('El research se cortó por largo (max_tokens).');
    // Terminó sin guardar: se lo pedimos una vez más y si no, se corta.
    if (pedidoGuardar) break;
    pedidoGuardar = true;
    messages.push({ role: 'user', content: 'Ahora guardá los temas con la herramienta guardar_temas.' });
  }
  throw new Error('El research terminó sin proponer temas.');
}
