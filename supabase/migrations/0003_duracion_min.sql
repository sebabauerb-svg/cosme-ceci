-- Duración de la consulta por turno: Ceci la define al abrir cada rango
-- horario (ej. "cada 30 min") en vez de un valor fijo por sede en el código.
-- Se guarda en franjas y se copia a la reserva al momento de reservar.
alter table franjas add column if not exists duracion_min integer not null default 30;
alter table reservas add column if not exists duracion_min integer;
