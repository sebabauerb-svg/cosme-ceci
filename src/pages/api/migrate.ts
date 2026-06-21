import type { APIRoute } from 'astro';
import { getSql } from '../../lib/db';

// Endpoint de migración (one-shot). Crea el esquema usando la MISMA conexión que la app,
// así las tablas caen exactamente en la base que la app lee.
// Uso: GET /api/migrate?go=1   (el preview está protegido por login de Vercel)
// Se borra después de aplicar.
export const prerender = false;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const STATEMENTS: string[] = [
  `create table if not exists sedes (
     id uuid primary key default gen_random_uuid(),
     nombre text not null unique,
     activa boolean not null default true,
     orden int not null default 0,
     created_at timestamptz not null default now()
   )`,
  `create table if not exists disponibilidad (
     id uuid primary key default gen_random_uuid(),
     sede_id uuid references sedes(id) on delete cascade,
     dia_semana smallint not null check (dia_semana between 0 and 6),
     hora time not null,
     duracion_min int not null default 30,
     activo boolean not null default true,
     created_at timestamptz not null default now(),
     unique (sede_id, dia_semana, hora)
   )`,
  `create table if not exists bloqueos (
     id uuid primary key default gen_random_uuid(),
     sede_id uuid references sedes(id) on delete cascade,
     fecha date not null,
     motivo text,
     created_at timestamptz not null default now()
   )`,
  `do $$ begin
     create type reserva_estado as enum ('pendiente_pago','confirmada','cancelada','expirada');
   exception when duplicate_object then null; end $$`,
  `create table if not exists reservas (
     id uuid primary key default gen_random_uuid(),
     created_at timestamptz not null default now(),
     modalidad text not null,
     sede_id uuid references sedes(id),
     fecha date,
     hora time,
     nombre text not null,
     telefono text not null,
     email text,
     precio_uyu numeric(10,2),
     estado reserva_estado not null default 'pendiente_pago',
     mp_preference_id text,
     mp_payment_id text,
     mp_estado text,
     expira_at timestamptz,
     notas text
   )`,
  `create unique index if not exists reservas_slot_unico
     on reservas (coalesce(sede_id::text, 'online'), fecha, hora)
     where estado in ('pendiente_pago','confirmada') and fecha is not null`,
  `insert into sedes (nombre, orden) values ('Montevideo', 1), ('San José', 2)
     on conflict (nombre) do nothing`,
];

export const GET: APIRoute = async ({ url }) => {
  if (url.searchParams.get('go') !== '1') {
    return json({ ok: false, hint: 'Agregá ?go=1 para ejecutar la migración.' }, 400);
  }
  let hechas = 0;
  try {
    const sql = getSql();
    for (const stmt of STATEMENTS) {
      await sql.query(stmt);
      hechas++;
    }
    const tablas = (
      await sql`select table_name from information_schema.tables where table_schema = 'public' order by 1`
    ).map((r: any) => r.table_name);
    const sedes = (await sql`select nombre from sedes order by orden`).map((r: any) => r.nombre);
    return json({ ok: true, sentencias: hechas, tablas, sedes });
  } catch (e) {
    return json(
      { ok: false, sentencias: hechas, error: e instanceof Error ? e.message : String(e) },
      500
    );
  }
};
