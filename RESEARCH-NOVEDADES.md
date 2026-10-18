# Research semanal de novedades

Cada **domingo a las 8:00** (hora de Uruguay) el sitio busca en la web qué hay de nuevo en cosmetología y skincare. Propone **de 5 a 8 temas** con fuentes para escribir novedades, tips o notas.

## Cómo funciona

1. El cron de Vercel llama a `/api/cron/research` (ver `vercel.json`).
2. Claude (`claude-opus-5-5`, con búsqueda web) investiga y propone los temas. Usa las instrucciones de `src/lib/research.ts`.
3. Los temas quedan en el panel: **/admin → Novedades → Agenda de temas**, como *Idea*. A Ceci le llega un mail con la lista (a `CECI_NOTIF_EMAIL`).
4. Ceci elige un tema y toca **Escribir**. Se abre el editor con el título, y el ángulo y las fuentes se muestran como guía. Ese texto no se publica.
5. Cuando guarda, el tema pasa a *La voy a escribir* (si quedó como borrador) o a *Publicada*.

Ceci también puede **anotar sus propios temas** en la agenda y tocar **Investigar ahora** (como mucho una vez cada 6 horas).

> La IA **propone temas, no escribe ni publica**. El texto lo escribe Ceci con su criterio y revisando las fuentes: sin prometer curas ni resultados garantizados, sin cifras sin fuente y sin precios de tratamientos.

## Lo que hace falta en Vercel

| Variable | Para qué |
|---|---|
| `ANTHROPIC_API_KEY` | **Nueva.** La clave de la API de Claude (console.anthropic.com). Sin ella, el research no corre y el botón no aparece. |
| `CRON_SECRET` | Ya existe. Protege el cron: cada corrida cuesta. |
| `RESEND_API_KEY`, `CECI_NOTIF_EMAIL` | Ya existen. El mail del domingo a Ceci. |

**Costo estimado:** entre 0,30 y 0,60 USD por corrida (hasta 10 búsquedas web a 0,01 USD cada una, más los tokens). Son unos 2 USD por mes. Conviene ponerle un límite mensual de gasto en la consola de Anthropic.

## Prompt de respaldo (para usarlo en otra IA)

Si algún día Ceci prefiere recibir el research en su ChatGPT, Claude u otra IA (por ejemplo, como tarea programada los domingos), puede pegar esto. Es el mismo criterio que usa el sitio, pero devuelve la lista en texto en lugar de cargarla en el panel. Después ella anota los temas que le interesen en la agenda.

```text
Sos el asistente editorial de Cecilia Gutiérrez, cosmetóloga médica con consultorio en Montevideo y San José (Uruguay). Ella publica en su web entradas cortas para sus pacientes: novedades (tendencias o noticias del momento), tips (recomendaciones prácticas) y notas (artículos más largos).

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

Al final, devolvé la lista de temas numerada, con todos esos campos y las URLs de las fuentes.
```
