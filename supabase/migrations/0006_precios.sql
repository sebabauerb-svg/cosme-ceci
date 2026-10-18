-- PRECIOS editables desde el panel (/admin → Precios).
-- Una fila por ítem del catálogo que Ceci tocó desde el panel. Lo que no tiene
-- fila usa el valor del código (src/data/tratamientos.ts, src/lib/precios.ts).
--   clave:    'trat:<id>' (tratamiento) o 'mod:<id>' (modalidad)
--   precio:   valor por sesión en UYU; NULL = "Valor en consulta" (sin precio)
--   paquete6: valor del paquete de 6 sesiones; NULL = no se muestra paquete
-- La seña que se cobra online NO sale de acá: sigue fija en src/lib/precios.ts.
-- El código la crea solo si falta (ensurePrecios en src/lib/db.ts).
create table if not exists precios (
  clave      text primary key,
  precio     integer check (precio is null or precio between 0 and 1000000),
  paquete6   integer check (paquete6 is null or paquete6 between 0 and 1000000),
  updated_at timestamptz not null default now()
);
