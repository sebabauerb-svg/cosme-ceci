-- Horario SEMANAL recurrente: Ceci define su "semana típica" una vez (por día
-- de la semana y sede, un rango horario + duración de consulta). Los turnos
-- concretos se generan hacia adelante desde acá. Reemplaza el modelo de
-- "franjas por fecha". Los bloqueos (fechas puntuales sin atención) siguen igual.
--   dia_semana: 0=domingo … 6=sábado
--   sede_id NULL = modalidades online (virtual / skincare)
create table if not exists horario_semanal (
  id           uuid primary key default gen_random_uuid(),
  sede_id      uuid references sedes(id) on delete cascade,
  dia_semana   smallint not null check (dia_semana between 0 and 6),
  hora_desde   time not null,
  hora_hasta   time not null,
  duracion_min integer not null default 30,
  created_at   timestamptz not null default now()
);

alter table horario_semanal enable row level security;
drop policy if exists "horario_lectura_publica" on horario_semanal;
create policy "horario_lectura_publica" on horario_semanal for select using (true);
