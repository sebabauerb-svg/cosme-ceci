# Cómo publicar una novedad

Las novedades, tips y notas aparecen en `/blog` (menú **Novedades**) y las 3 más recientes en el
bloque **Lo último** de la home. Se cargan desde el panel, sin tocar código.

## Desde el panel (lo normal)

1. Entrá a `/admin` con tu contraseña y abrí la pestaña **Novedades**.
2. Tocá **Nueva entrada** y completá:
   - **Título**: corto y claro.
   - **Descripción**: una o dos frases (hasta 160 caracteres). Es lo que se ve en la tarjeta y en
     Google.
   - **Tipo**: ver la tabla de abajo.
   - **Fecha**: viene con la de hoy. Ordena las entradas (la más nueva primero).
   - **Texto**: párrafos separados por una línea en blanco. `**así**` queda en **negrita** y las
     listas se hacen empezando la línea con `1.` o `-`.
   - **Publicada**: si la desmarcás, queda guardada como **borrador** y no sale en la web.
3. Tocá **Guardar**. En **1 o 2 minutos** se ve en la web (el sitio se vuelve a publicar solo).

En la lista de la pestaña podés **Editar** cualquier entrada, **Despublicar** una que ya está en la
web (pasa a borrador, no se borra) o **Publicar** un borrador. **Ver** abre la página publicada.

No hace falta cerrar con "agendá tu consulta": cada entrada ya trae ese botón al final.

| Tipo      | Para qué                                         | Largo sugerido     |
|-----------|--------------------------------------------------|--------------------|
| Novedad   | Una tendencia, un producto o un tema del momento | 100 a 250 palabras |
| Tip       | Una recomendación práctica para la rutina        | 80 a 200 palabras  |
| Nota      | Un artículo largo (el blog de siempre)           | 500 palabras o más |

### Antes de publicar: chequeo rápido

- Nada de prometer curas ni resultados garantizados ("elimina", "100% efectivo").
- Nada de cifras sin fuente ("el 80% de las mujeres…").
- Sin precios de tratamientos (solo la Consulta tiene precio en la web).
- Si nombrás una marca o producto, que sea una recomendación genuina, no publicidad paga
  encubierta.

Hay dos borradores de ejemplo para tomar de modelo: "Skin cycling" (novedad) y "Primavera: momento
de revisar tu protector solar" (tip). Están sin publicar hasta que Ceci revise el texto.

## Cómo funciona por dentro (Sebas)

Cada entrada es un archivo `.md` en `src/content/blog/`. El panel no usa la base de datos: al
guardar, hace un commit de ese archivo a `main` por la API de GitHub
(`src/lib/novedades.ts`, endpoint `/api/admin/novedades`) y Vercel despliega. El blog sigue siendo
estático y los `.md` son la única fuente, así que lo que se carga desde el panel y lo que se sube a
mano conviven sin diferencia. La dirección de la página sale del título al crearla
(`/blog/titulo-sin-tildes`) y no cambia aunque después se edite el título.

**Configuración (una sola vez), en Vercel → Settings → Environment Variables (Production):**

- `GITHUB_TOKEN`: token *fine-grained* de la cuenta de Sebas
  (GitHub → Settings → Developer settings → Fine-grained tokens), con acceso **solo** al repo
  `cosme-ceci` y permiso **Contents: Read and write**. Tiene que ser de la cuenta dueña del repo:
  así Vercel despliega los commits sin pedir aprobación. Anotá cuándo vence y renovalo antes.
- Opcionales: `GITHUB_REPO` (por defecto `sebabauerb-svg/cosme-ceci`) y `GITHUB_BRANCH`
  (por defecto `main`).

Sin `GITHUB_TOKEN`, la pestaña avisa que el editor no está conectado y el resto del panel funciona
igual.

### Subirlo a mano (alternativa)

El nombre del archivo es la dirección de la página: `protector-solar-primavera.md` se publica en
`/blog/protector-solar-primavera`. Minúsculas, sin tildes ni espacios (guiones en su lugar).

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
```

Se sube desde GitHub en el navegador (`src/content/blog/` → **Add file → Create new file** →
**Commit changes** a `main`) o desde la compu con commit + push. Con `npm run dev` los borradores
se ven con la etiqueta "Borrador". Si el panel guarda un archivo que se escribió a mano, lo
reescribe en este mismo formato (se pierden los comentarios `#` del encabezado).
