-- ============================================================
-- Fichas de pacientes + recordatorio "volvé a consultar"
-- El código aplica esto solo, idempotente, vía ensurePacientes()
-- en src/lib/db.ts. Este archivo queda como referencia/documentación.
-- (0006 y 0007 los usan las ramas de newsletter y agenda de temas.)
-- ============================================================

create table if not exists pacientes (
  id                    uuid primary key default gen_random_uuid(),
  nombre                text not null,
  fecha_nacimiento      date,          -- opcional; identificar homónimos y adaptar el cuidado a la etapa (ver aviso legal)
  email                 text,
  telefono              text,
  tel_norm              text,          -- teléfono en formato +598… para deduplicar
  email_norm            text,          -- email en minúsculas para deduplicar
  notas                 text,          -- de contacto/agenda; sin datos clínicos
  recordatorio_activo   boolean not null default true,   -- Ceci lo apaga por paciente
  baja_recordatorios_at timestamptz,   -- la paciente pidió no recibirlo
  token_baja            text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index if not exists pacientes_token_baja on pacientes (token_baja);
create index if not exists pacientes_tel_norm on pacientes (tel_norm);
create index if not exists pacientes_email_norm on pacientes (email_norm);

-- Cada reserva apunta a su ficha. La precarga desde las reservas existentes la
-- hace el código (vincularPendientes en src/lib/pacientes.ts), deduplicando por
-- teléfono o email normalizados.
alter table reservas add column if not exists paciente_id uuid references pacientes(id) on delete set null;
-- Marca: ya se mandó el "volvé a consultar" por esta consulta (uno por consulta).
alter table reservas add column if not exists vuelta_avisada_at timestamptz;
create index if not exists reservas_paciente on reservas (paciente_id);

-- Sin policies para anon: solo el backend lee/escribe.
alter table pacientes enable row level security;
