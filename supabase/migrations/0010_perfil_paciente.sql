-- ============================================================
-- Perfil de paciente: entrada con link mágico, sesión y "Mi registro".
-- Solo agrega: no borra ni reescribe nada. El código lo aplica solo,
-- idempotente, vía ensurePerfil() en src/lib/db.ts. Este archivo queda como
-- referencia/documentación.
-- El registro de piel es dato de salud (Ley 18.331): solo se guarda si la
-- paciente aceptó (registro_consentimiento_at).
-- Todo el perfil está apagado hasta PERFIL_PACIENTES_ACTIVO=true.
-- ============================================================

alter table pacientes add column if not exists registro_consentimiento_at timestamptz;

-- Links mágicos de un solo uso. Se guarda el sha256 del token, nunca el token.
create table if not exists pacientes_accesos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  token_hash  text not null unique,
  destino     text,                 -- a qué sección lleva (ej. 'registro')
  expira_at   timestamptz not null, -- 20 minutos
  usado_at    timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists pacientes_accesos_paciente on pacientes_accesos (paciente_id);
alter table pacientes_accesos enable row level security;

-- Sesiones de la paciente (cookie cg_paciente). Solo el hash del token.
create table if not exists pacientes_sesiones (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  token_hash  text not null unique,
  expira_at   timestamptz not null, -- 30 días
  created_at  timestamptz not null default now()
);
create index if not exists pacientes_sesiones_paciente on pacientes_sesiones (paciente_id);
alter table pacientes_sesiones enable row level security;

-- "Mi registro": cada envío es una entrada con fecha (historial de evolución).
create table if not exists registros_piel (
  id                uuid primary key default gen_random_uuid(),
  paciente_id       uuid not null references pacientes(id) on delete cascade,
  fecha             date not null,
  nota              integer check (nota is null or nota between 1 and 5), -- cómo siente la piel, 1 a 5
  sensaciones       text[],         -- opciones de src/data/registro.ts
  sensaciones_texto text,
  objetivos         text[],         -- OBJETIVOS de src/data/ficha.ts
  objetivos_texto   text,
  productos         jsonb,          -- [{momento, paso, producto}]
  cambios           text,           -- qué empezó/dejó, reacciones
  habitos           text[],         -- HABITOS de src/data/ficha.ts
  created_at        timestamptz not null default now()
);
create index if not exists registros_piel_paciente on registros_piel (paciente_id, fecha desc);
alter table registros_piel enable row level security;
