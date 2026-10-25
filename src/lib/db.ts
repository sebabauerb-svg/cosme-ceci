import { neon } from '@neondatabase/serverless';

/**
 * Cliente de base de datos (Neon · Postgres).
 * La conexión viene de las variables que inyecta la integración de Neon en Vercel.
 * Se resuelve en runtime (no al build) para no romper el build si falta la variable.
 */
export function getSql() {
  const cs =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!cs) {
    throw new Error(
      'Falta la variable de conexión a Neon (DATABASE_URL / POSTGRES_URL). ' +
        'Revisá la integración de Neon en Vercel.'
    );
  }
  return neon(cs);
}

/** Crea la tabla de franjas por fecha si no existe (idempotente).
 *  Cada fila = un turno disponible (sede_id NULL = online). */
export async function ensureFranjas(sql: any) {
  await sql`
    create table if not exists franjas (
      id uuid primary key default gen_random_uuid(),
      sede_id uuid references sedes(id) on delete cascade,
      fecha date not null,
      hora time not null,
      duracion_min integer not null default 30,
      unique (sede_id, fecha, hora)
    )
  `;
  await sql`alter table franjas add column if not exists duracion_min integer not null default 30`;
}

/** Columna para el id del evento de Google Calendar (idempotente). Permite
 *  borrar el evento del calendario si el turno se cancela. */
export async function ensureGoogleEventId(sql: any) {
  await sql`alter table reservas add column if not exists google_event_id text`;
}

/**
 * Duración de la consulta en la reserva (idempotente). Se copia desde el
 * horario semanal al reservar, para que el evento de Calendar quede del tamaño
 * correcto sin depender de un valor fijo por sede.
 */
export async function ensureDuracionMin(sql: any) {
  await sql`alter table reservas add column if not exists duracion_min integer`;
}

/**
 * Horario SEMANAL recurrente (idempotente). Ceci define su "semana típica" una
 * vez: por día de la semana y sede, un rango horario y la duración de la
 * consulta. Los turnos concretos se generan hacia adelante desde acá (ver
 * src/lib/agenda.ts). Reemplaza el modelo viejo de "franjas por fecha".
 *   dia_semana: 0=domingo … 6=sábado (Date.getUTCDay)
 *   sede_id NULL = modalidades online (virtual / skincare)
 */
export async function ensureHorarioSemanal(sql: any) {
  await sql`
    create table if not exists horario_semanal (
      id uuid primary key default gen_random_uuid(),
      sede_id uuid references sedes(id) on delete cascade,
      dia_semana smallint not null check (dia_semana between 0 and 6),
      hora_desde time not null,
      hora_hasta time not null,
      duracion_min integer not null default 30,
      created_at timestamptz not null default now()
    )
  `;
}

/**
 * Flujo de reserva SIN pago (Fase 2), idempotente. Debe correr antes de cualquier
 * query que mencione el estado 'a_confirmar' (comparar el enum con un valor
 * inexistente lanza en Postgres).
 *  - estado 'a_confirmar': reserva web que espera que Ceci la valide (hold 2 h).
 *  - monto_cobrado / pagado: seguimiento del cobro, que Ceci registra a mano
 *    (una reserva confirmada puede quedar con pagado=false para seguimiento).
 *  - el índice de cupo único pasa a bloquear también 'a_confirmar' (se recrea con
 *    otro nombre para no dropear/crear en cada request).
 */
/**
 * Panel de gestión de Ceci (idempotente). Separa lo que se acordó de lo que se
 * cobró, que es lo que `monto_cobrado`/`pagado` no distinguían:
 *  - total_acordado: el precio final de ESTA consulta. Puede diferir del precio
 *    de lista (descuentos, bonificación por contratar protocolo el mismo día).
 *  - sena_pagada: cuánto entró efectivamente como seña. El saldo se deriva
 *    (total_acordado - sena_pagada), no se guarda: así nunca queda desfasado.
 *  - forma_pago: 'mercadopago' | 'transferencia' | 'efectivo'.
 *  - recordatorio_at: cuándo se le avisó del turno, para no recordar dos veces.
 *  - notas: apunte libre de Ceci sobre el caso.
 */
export async function ensureGestion(sql: any) {
  await sql`alter table reservas add column if not exists total_acordado numeric(10,2)`;
  await sql`alter table reservas add column if not exists sena_pagada numeric(10,2)`;
  await sql`alter table reservas add column if not exists forma_pago text`;
  await sql`alter table reservas add column if not exists recordatorio_at timestamptz`;
  await sql`alter table reservas add column if not exists notas text`;
  // Backfill: lo que Ceci ya había marcado como cobrado era, de hecho, la seña.
  await sql`
    update reservas set sena_pagada = monto_cobrado
     where sena_pagada is null and pagado is true and monto_cobrado is not null
  `;
  // Backfill: hasta oct-2026 el webhook confirmaba el turno pero no anotaba la
  // seña, así que esos turnos figuraban "sin seña" y el recordatorio cobraba el
  // total. Lo que MercadoPago aprobó por el monto esperado ES la seña.
  await sql`
    update reservas
       set sena_pagada = precio_uyu, pagado = true, forma_pago = coalesce(forma_pago, 'mercadopago')
     where sena_pagada is null and estado = 'confirmada' and mp_estado = 'approved'
       and precio_uyu is not null
  `;
  await ensureAutogestion(sql);
}

/**
 * Autogestión de la paciente (idempotente): cada reserva lleva un código secreto
 * que va en el link "cambiar mi horario" de los mails y mensajes. Con ese link
 * la paciente reprograma sola, sin login.
 *  - token_gestion: 32 hex al azar. El default volátil hace que Postgres le
 *    asigne uno distinto a cada reserva existente al crear la columna, y a cada
 *    reserva nueva al insertarla (no hace falta tocar el INSERT de /reservar).
 *  - cambios_paciente: cuántas veces reprogramó ella; tope en src/lib/reprogramar.ts.
 */
export async function ensureAutogestion(sql: any) {
  await sql`
    alter table reservas add column if not exists token_gestion text
      default replace(gen_random_uuid()::text, '-', '')
  `;
  await sql`alter table reservas add column if not exists cambios_paciente integer not null default 0`;
  await sql`create unique index if not exists reservas_token_gestion on reservas (token_gestion)`;
}

export async function ensureConfirmacion(sql: any) {
  await sql`alter type reserva_estado add value if not exists 'a_confirmar'`;
  await sql`alter table reservas add column if not exists monto_cobrado numeric(10,2)`;
  await sql`alter table reservas add column if not exists pagado boolean`;
  await sql`
    create unique index if not exists reservas_slot_unico_v2
      on reservas (coalesce(sede_id::text, 'online'), fecha, hora)
      where estado in ('pendiente_pago','confirmada','a_confirmar') and fecha is not null
  `;
  await sql`drop index if exists reservas_slot_unico`;
}

/**
 * Newsletter de novedades (idempotente). La base es la fuente de verdad de
 * quién quiere recibir mails: el envío sale por lotes de Resend, sin copiar la
 * lista a Resend (así la baja y el consentimiento viven en un solo lugar).
 *  - newsletter_suscriptores: doble opt-in. 'pendiente' hasta que toca el link
 *    del mail de confirmación; 'baja' cuando se da de baja (la fila queda como
 *    registro de que pidió no recibir más, y por si vuelve a suscribirse).
 *    token: secreto del link de confirmación y de baja (sin login).
 *  - newsletter_envios: cada newsletter que arma Ceci (asunto, intro, entradas).
 *  - newsletter_entregas: a quién ya le salió cada envío. Permite repartir un
 *    envío grande en varios días sin pasarse del tope diario del plan de Resend
 *    y sin mandarle dos veces lo mismo a nadie.
 */
export async function ensureNewsletter(sql: any) {
  await sql`
    create table if not exists newsletter_suscriptores (
      id uuid primary key default gen_random_uuid(),
      email text not null unique,
      estado text not null default 'pendiente' check (estado in ('pendiente','confirmado','baja')),
      token text not null unique default replace(gen_random_uuid()::text, '-', ''),
      origen text,
      consentimiento_at timestamptz not null default now(),
      confirmacion_enviada_at timestamptz,
      confirmado_at timestamptz,
      baja_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists newsletter_envios (
      id uuid primary key default gen_random_uuid(),
      asunto text not null,
      intro text,
      entradas text[] not null,
      total integer not null default 0,
      enviados integer not null default 0,
      created_at timestamptz not null default now(),
      terminado_at timestamptz
    )
  `;
  await sql`
    create table if not exists newsletter_entregas (
      envio_id uuid not null references newsletter_envios(id) on delete cascade,
      suscriptor_id uuid not null references newsletter_suscriptores(id) on delete cascade,
      enviado_at timestamptz not null default now(),
      primary key (envio_id, suscriptor_id)
    )
  `;
  await sql`create index if not exists newsletter_entregas_fecha on newsletter_entregas (enviado_at)`;
  // Supresión (Ley 18.331, derecho de supresión): el email se reemplaza por uno
  // anónimo y queda la fecha como constancia. La fila no se borra para que las
  // entregas pasadas sigan cuadrando y quede registro de que se hizo.
  await sql`alter table newsletter_suscriptores add column if not exists suprimido_at timestamptz`;
  // Fotos elegidas para el mail ({ cabecera, porEntrada: { slug: foto } }), para
  // que "Continuar envío" arme exactamente el mismo mail días después.
  await sql`alter table newsletter_envios add column if not exists fotos jsonb`;
  // Desde oct-2026 el alta es directa (sin doble opt-in): quienes quedaron
  // "pendiente" con el sistema anterior marcaron la casilla de consentimiento,
  // así que pasan a suscriptas. Las altas nuevas ya no quedan pendientes.
  await sql`
    update newsletter_suscriptores set estado = 'confirmado', confirmado_at = coalesce(confirmado_at, now())
     where estado = 'pendiente'
  `;
}

/**
 * Agenda de temas para las novedades (idempotente). Ideas para escribir: las
 * que suma el research automático de los lunes (origen 'research') y las que
 * anota Ceci a mano (origen 'ceci').
 *   estado: 'idea' → 'elegido' (lo va a escribir) → 'publicado' | 'descartado'
 *   fuentes: [{ titulo, url }] de donde salió el tema (solo el research).
 *   slug: la entrada del blog que salió del tema, cuando se escribe desde el panel.
 */
export async function ensureTemas(sql: any) {
  await sql`
    create table if not exists agenda_temas (
      id uuid primary key default gen_random_uuid(),
      titulo text not null,
      resumen text,
      angulo text,
      tipo text check (tipo in ('novedad','tip','nota')),
      fuentes jsonb not null default '[]'::jsonb,
      evidencia text,
      estado text not null default 'idea' check (estado in ('idea','elegido','publicado','descartado')),
      origen text not null default 'ceci' check (origen in ('research','ceci')),
      slug text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists agenda_temas_estado on agenda_temas (estado, created_at desc)`;
}

/**
 * Precios editables desde el panel (idempotente). Ver
 * supabase/migrations/0006_precios.sql y src/lib/precios-vigentes.ts.
 */
export async function ensurePrecios(sql: any) {
  await sql`
    create table if not exists precios (
      clave text primary key,
      precio integer check (precio is null or precio between 0 and 1000000),
      paquete6 integer check (paquete6 is null or paquete6 between 0 and 1000000),
      updated_at timestamptz not null default now()
    )
  `;
}

/**
 * Fichas de pacientes (idempotente). Ver supabase/migrations/0008_pacientes.sql
 * y src/lib/pacientes.ts.
 *  - tel_norm / email_norm: teléfono y email normalizados, para reconocer a la
 *    misma paciente entre reservas aunque los haya escrito distinto.
 *  - fecha_nacimiento: opcional, la carga Ceci (ver el aviso legal: para qué).
 *  - notas: de contacto/agenda. NO datos clínicos.
 *  - recordatorio_activo: Ceci apaga el "volvé a consultar" de esta paciente.
 *  - baja_recordatorios_at: la paciente pidió no recibirlo (link de baja).
 *  - token_baja: va en el link de baja, sin login.
 * En reservas: paciente_id (la ficha) y vuelta_avisada_at (marca de que ya se
 * mandó el "volvé a consultar" por ESA consulta: uno solo por consulta).
 *
 * Seguimiento clínico (pedido de Sebas, oct-2026). Son datos de salud: datos
 * sensibles para la Ley 18.331, así que solo se cargan si la ficha tiene la
 * fecha del consentimiento firmado (lo controla /api/admin/pacientes):
 *  - pacientes.consentimiento_fecha: cuándo firmó el consentimiento.
 *  - reservas.tratamientos: jsonb [{ id, nombre, sesion, de }] de lo que se
 *    hizo en esa consulta (id del catálogo de src/data/tratamientos.ts, o
 *    'otro'; el nombre se guarda para que el historial no cambie si el
 *    catálogo cambia).
 *  - reservas.evolucion: nota de evolución de esa consulta.
 */
export async function ensurePacientes(sql: any) {
  await sql`
    create table if not exists pacientes (
      id uuid primary key default gen_random_uuid(),
      nombre text not null,
      fecha_nacimiento date,
      email text,
      telefono text,
      tel_norm text,
      email_norm text,
      notas text,
      recordatorio_activo boolean not null default true,
      baja_recordatorios_at timestamptz,
      token_baja text not null default replace(gen_random_uuid()::text, '-', ''),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create unique index if not exists pacientes_token_baja on pacientes (token_baja)`;
  await sql`create index if not exists pacientes_tel_norm on pacientes (tel_norm)`;
  await sql`create index if not exists pacientes_email_norm on pacientes (email_norm)`;
  await sql`alter table reservas add column if not exists paciente_id uuid references pacientes(id) on delete set null`;
  await sql`alter table reservas add column if not exists vuelta_avisada_at timestamptz`;
  await sql`alter table pacientes add column if not exists consentimiento_fecha date`;
  await sql`alter table reservas add column if not exists tratamientos jsonb`;
  await sql`alter table reservas add column if not exists evolucion text`;
  await sql`alter table reservas add column if not exists atencion_at timestamptz`;
  await sql`create index if not exists reservas_paciente on reservas (paciente_id)`;
  await sql`alter table pacientes enable row level security`;
}
