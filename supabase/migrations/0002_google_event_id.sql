-- Guarda el id del evento creado en el Google Calendar de Ceci al confirmarse
-- el pago, para poder borrarlo si el turno se cancela o reprograma.
alter table reservas add column if not exists google_event_id text;
