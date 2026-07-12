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

/** Crea la tabla de franjas por fecha si no existe (idempotente). */
export async function ensureFranjas(sql: any) {
  await sql`
    create table if not exists franjas (
      id uuid primary key default gen_random_uuid(),
      sede_id uuid references sedes(id) on delete cascade,
      fecha date not null,
      hora time not null,
      unique (sede_id, fecha, hora)
    )
  `;
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
