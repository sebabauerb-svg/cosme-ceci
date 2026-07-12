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
