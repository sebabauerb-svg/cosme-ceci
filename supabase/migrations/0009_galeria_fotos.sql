-- "Mis fotos": fotos que Ceci sube desde el panel (pestaña Fotos) para el
-- newsletter y la portada de las novedades. Los archivos viven en Vercel Blob
-- (público); acá queda el nombre y la dirección base (sin -ancha.jpg / .jpg).
-- Referencia: el código la crea sola (ensureFotos en src/lib/fotos.ts).
create table if not exists galeria_fotos (
  id                 text primary key,                 -- f-<16 hex>
  etiqueta           text not null,
  base_url           text not null unique,
  created_at         timestamptz not null default now(),
  borrada_at         timestamptz,                      -- ya no se ofrece en el panel
  archivos_borrados  boolean not null default false    -- false = siguen en Blob (p. ej. salió en un newsletter)
);
