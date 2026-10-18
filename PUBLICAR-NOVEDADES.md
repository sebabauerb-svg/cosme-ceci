# Cómo publicar una novedad

Las novedades, tips y notas viven en `src/content/blog/`, un archivo `.md` por entrada.
Aparecen en `/blog` (menú **Novedades**) y las 3 más recientes en el bloque **Lo último**
de la home. No hace falta tocar código.

## 1. Elegí el tipo

| `tipo`    | Para qué                                         | Largo sugerido     |
|-----------|--------------------------------------------------|--------------------|
| `novedad` | Una tendencia, un producto o un tema del momento | 100 a 250 palabras |
| `tip`     | Una recomendación práctica para la rutina        | 80 a 200 palabras  |
| `nota`    | Un artículo largo (el blog de siempre)           | 500 palabras o más |

## 2. Creá el archivo

El nombre del archivo es la dirección de la página: `protector-solar-primavera.md` se publica en
`/blog/protector-solar-primavera`. Usá minúsculas, sin tildes ni espacios (guiones en su lugar).

Copiá esta plantilla:

```markdown
---
titulo: "Título corto y claro"
descripcion: "Una o dos frases. Es lo que se ve en la tarjeta y en Google (hasta 160 caracteres)."
fecha: 2026-10-20
autora: "Ceci"
tipo: novedad
publicado: true
---

Acá va el texto. Párrafos separados por una línea en blanco.

**Negrita** para resaltar, y listas con `1.` o `-`.
```

- `fecha`: año-mes-día. Ordena las entradas (la más nueva primero).
- `publicado: false` lo deja como **borrador**: no sale en la web. Sirve para dejar textos
  preparados.
- No hace falta cerrar con "agendá tu consulta": cada entrada ya trae ese botón al final.

## 3. Subilo

**Desde GitHub en el navegador (lo más simple):** en el repo, entrá a `src/content/blog/`,
**Add file → Create new file**, pegá la plantilla completa y tocá **Commit changes** directo a
`main`. Vercel publica en uno o dos minutos.

**Desde la compu (Sebas):** creá el archivo, revisalo con `npm run dev` (los borradores se ven
ahí, con la etiqueta "Borrador") y hacé commit + push a `main`.

## Antes de publicar: chequeo rápido

- Nada de prometer curas ni resultados garantizados ("elimina", "100% efectivo").
- Nada de cifras sin fuente ("el 80% de las mujeres…").
- Sin precios de tratamientos (solo la Consulta tiene precio en la web).
- Si nombrás una marca o producto, que sea una recomendación genuina, no publicidad paga
  encubierta.

Hay dos borradores de ejemplo para tomar de modelo: `skin-cycling-que-hay-detras.md` (novedad)
y `protector-solar-primavera.md` (tip). Están en `publicado: false` hasta que Ceci revise el texto.
