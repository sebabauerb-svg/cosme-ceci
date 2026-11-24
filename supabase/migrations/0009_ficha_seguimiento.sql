-- ============================================================
-- Ficha de seguimiento: anamnesis, plan de tratamiento, registro por sesión
-- y fotos. Solo agrega: no borra ni reescribe lo que ya cargó Ceci.
-- El código lo aplica solo, idempotente, vía ensureSeguimiento() en
-- src/lib/db.ts. Este archivo queda como referencia/documentación.
-- Datos de salud (sensibles, Ley 18.331): el panel solo los escribe si la
-- ficha tiene consentimiento_fecha.
-- ============================================================

alter table pacientes add column if not exists motivo text;            -- motivo de consulta
alter table pacientes add column if not exists objetivos text[];       -- opciones de src/data/ficha.ts
alter table pacientes add column if not exists anamnesis jsonb;        -- {antecedentes[], alergias, medicacion, fototipo, tipo_piel, condiciones[], habitos[], rutina, otros}
alter table pacientes add column if not exists anamnesis_at timestamptz; -- última revisión

create table if not exists planes (
  id             uuid primary key default gen_random_uuid(),
  paciente_id    uuid not null references pacientes(id) on delete cascade,
  tratamiento_id text,                -- id del catálogo (src/data/tratamientos.ts) o null si es "otro"
  tratamiento    text not null,       -- nombre guardado: el historial no cambia si cambia el catálogo
  sesiones       integer check (sesiones is null or sesiones between 1 and 50),
  frecuencia     text,
  inicio         date,
  paquete        text,
  protocolo      text,
  estado         text not null default 'en_curso' check (estado in ('en_curso','pausado','terminado')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists planes_paciente on planes (paciente_id);
alter table planes enable row level security;

-- Registro por sesión, sobre la reserva (turno) en la que se atendió.
alter table reservas add column if not exists plan_id uuid references planes(id) on delete set null;
alter table reservas add column if not exists hizo text;           -- activos o equipo, concentración, tiempo, parámetros
alter table reservas add column if not exists tolerancia text;     -- src/data/ficha.ts TOLERANCIAS
alter table reservas add column if not exists indicaciones text;   -- para casa
alter table reservas add column if not exists proxima_fecha date;  -- próxima sesión sugerida

-- Fotos antes/después. Se comprimen en el navegador (~1280 px) y se guardan acá
-- con una miniatura. Solo se sirven con la sesión del panel (/api/admin/foto).
create table if not exists fotos (
  id          uuid primary key default gen_random_uuid(),
  paciente_id uuid not null references pacientes(id) on delete cascade,
  reserva_id  uuid references reservas(id) on delete set null,
  fecha       date not null,
  etiqueta    text,
  mime        text not null,
  datos       bytea not null,
  mini        bytea not null,
  bytes       integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists fotos_paciente on fotos (paciente_id);
alter table fotos enable row level security;
