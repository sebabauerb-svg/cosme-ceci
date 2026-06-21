-- ============================================================
-- Skincare / Cecilia Gutiérrez · Cosmetología Médica
-- Esquema inicial de reservas (Fase 2b)
-- Aplicar con: supabase db push  (o el MCP apply_migration)
-- ============================================================

-- ----- SEDES (lugares de atención presencial) -----
create table if not exists sedes (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  activa      boolean not null default true,
  orden       int not null default 0,
  created_at  timestamptz not null default now()
);

-- ----- DISPONIBILIDAD semanal recurrente -----
-- sede_id NULL = modalidades online (virtual / skincare).
-- Acá Ceci define qué día y hora atiende en cada sede.
create table if not exists disponibilidad (
  id           uuid primary key default gen_random_uuid(),
  sede_id      uuid references sedes(id) on delete cascade,
  dia_semana   smallint not null check (dia_semana between 0 and 6), -- 0=domingo … 6=sábado
  hora         time not null,
  duracion_min int not null default 30,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  unique (sede_id, dia_semana, hora)
);

-- ----- BLOQUEOS de fechas puntuales (feriados, licencia) -----
create table if not exists bloqueos (
  id          uuid primary key default gen_random_uuid(),
  sede_id     uuid references sedes(id) on delete cascade, -- NULL = todas las sedes
  fecha       date not null,
  motivo      text,
  created_at  timestamptz not null default now()
);

-- ----- RESERVAS -----
do $$ begin
  create type reserva_estado as enum ('pendiente_pago','confirmada','cancelada','expirada');
exception when duplicate_object then null; end $$;

create table if not exists reservas (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  modalidad      text not null,                 -- presencial | virtual | skincare-inteligente | club
  sede_id        uuid references sedes(id),     -- NULL para online / club
  fecha          date,                          -- NULL para club (membresía)
  hora           time,                          -- NULL para club
  nombre         text not null,
  telefono       text not null,
  email          text,
  precio_uyu     numeric(10,2),
  estado         reserva_estado not null default 'pendiente_pago',
  -- Pago (Mercado Pago)
  mp_preference_id text,
  mp_payment_id    text,
  mp_estado        text,
  expira_at      timestamptz,                   -- para liberar reservas no pagadas
  notas          text
);

-- Evitar doble reserva del MISMO turno (presencial u online).
-- coalesce trata "online" (sede_id NULL) como un único cupo por fecha/hora.
create unique index if not exists reservas_slot_unico
  on reservas (coalesce(sede_id::text, 'online'), fecha, hora)
  where estado in ('pendiente_pago','confirmada') and fecha is not null;

-- ============================================================
-- SEGURIDAD (RLS) — todo cerrado por defecto
-- Lectura pública solo de la agenda; las reservas las maneja el backend
-- (service_role bypassa RLS). El anon key NO puede leer reservas de nadie.
-- ============================================================
alter table sedes          enable row level security;
alter table disponibilidad enable row level security;
alter table bloqueos       enable row level security;
alter table reservas       enable row level security;

drop policy if exists "sedes_lectura_publica" on sedes;
create policy "sedes_lectura_publica" on sedes
  for select using (activa = true);

drop policy if exists "disp_lectura_publica" on disponibilidad;
create policy "disp_lectura_publica" on disponibilidad
  for select using (activo = true);

drop policy if exists "bloqueos_lectura_publica" on bloqueos;
create policy "bloqueos_lectura_publica" on bloqueos
  for select using (true);

-- reservas: sin policies para anon → acceso denegado.
-- El endpoint del servidor escribe/lee con la service_role key.

-- ----- SEED: las dos sedes de Ceci -----
insert into sedes (nombre, orden) values ('Montevideo', 1), ('San José', 2)
on conflict (nombre) do nothing;

-- Ejemplo de cómo Ceci cargaría disponibilidad (descomentar y ajustar):
-- insert into disponibilidad (sede_id, dia_semana, hora)
-- select id, 1, t.hora::time from sedes, (values ('09:00'),('10:30'),('14:00')) as t(hora)
-- where nombre = 'Montevideo';   -- lunes en Montevideo
