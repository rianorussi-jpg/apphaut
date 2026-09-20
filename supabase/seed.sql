-- Categorías oficiales HAUT para instalaciones nuevas.
-- Ejecutar sólo al preparar una base nueva; para una base existente usar
-- supabase/migrations/20260920090000_catalogo_haut.sql.
-- "Todos" y "Favoritos" son filtros de la app; no son categorías SQL.
insert into public.treatment_categories (name, slug, sort_order)
values
  ('Depilación láser', 'depilacion-laser', 10),
  ('Corporales', 'corporales', 20),
  ('Faciales', 'faciales', 30)
on conflict (slug) do nothing;
