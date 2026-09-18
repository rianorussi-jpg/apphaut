-- Datos de desarrollo controlados.
-- “Favoritos” NO se crea como categoría: se representa mediante treatments.is_featured.

insert into public.treatment_categories (name, slug, sort_order)
values
  ('Faciales', 'faciales', 10),
  ('Corporales', 'corporales', 20),
  ('Depilación', 'depilacion', 30),
  ('Aparatología', 'aparatologia', 40),
  ('Otros', 'otros', 50)
on conflict (slug) do nothing;

-- No se crean sucursales ficticias. Las sucursales reales de Haut se cargarán
-- cuando se confirme su información operativa.
