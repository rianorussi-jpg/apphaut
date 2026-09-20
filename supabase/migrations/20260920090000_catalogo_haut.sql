-- Catálogo HAUT: tres categorías y 17 tratamientos solicitados.
-- Ejecutar UNA VEZ en el Supabase correcto de HAUT, después de las migraciones anteriores.
-- Transacción atómica: ante un error no se aplican cambios parciales.
begin;

-- Un tratamiento puede aparecer en el catálogo antes de tener confirmados sus
-- datos comerciales. Los valores 0 MXN, 60 min y 1 sesión se usan únicamente
-- como placeholders técnicos para los registros NUEVOS: NO deben publicarse ni
-- usarse para reservar mientras catalog_details_pending = true.
alter table public.treatments
  add column if not exists catalog_details_pending boolean not null default false;

-- Un plan no se puede iniciar mientras los valores comerciales del tratamiento
-- sigan pendientes, aunque alguien cree una asociación de sucursal manualmente.
create or replace function public.haut_block_unconfigured_plan()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1 from public.treatments t
    where t.id = new.treatment_id and t.catalog_details_pending
  ) then
    raise exception 'Configura precio, duración y sesiones del tratamiento antes de asignarlo o reservarlo.';
  end if;
  return new;
end;
$$;
drop trigger if exists haut_block_unconfigured_plan on public.client_treatment_plans;
create trigger haut_block_unconfigured_plan
  before insert or update of treatment_id on public.client_treatment_plans
  for each row execute function public.haut_block_unconfigured_plan();

-- Categorías reales. "Todos" y "Favoritos" son filtros, no categorías SQL.
insert into public.treatment_categories(name,slug,sort_order,is_active)
values
  ('Depilación láser','depilacion-laser',10,true),
  ('Corporales','corporales',20,true),
  ('Faciales','faciales',30,true)
on conflict (slug) do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true;

-- Las categorías antiguas se conservan, pero ya no aparecen como pestañas.
update public.treatment_categories
set is_active = false
where slug not in ('depilacion-laser','corporales','faciales') and is_active;

-- Solo las tres selecciones solicitadas aparecen en el filtro "Favoritos".
-- No se eliminan tratamientos preexistentes ni sus planes/citas.
update public.treatments set is_featured = false where is_featured;

do $$
declare
  r record;
  v_category_id uuid;
  v_treatment_id uuid;
begin
  for r in
    select * from (values
      ('Carboxiterapia',              'carboxiterapia',             'corporales',       false),
      ('Cavitación',                 'cavitacion',                'corporales',       true),
      ('Radiofrecuencia',            'radiofrecuencia',           'corporales',       false),
      ('Vacummterapia',              'vacummterapia',             'corporales',       false),
      ('Presoterapia',               'presoterapia',              'corporales',       false),
      ('Hidrolipoclasia',            'hidrolipoclasia',           'corporales',       false),
      ('Peptonas',                   'peptonas',                  'corporales',       false),
      ('Criolipólisis',              'criolipolisis',             'corporales',       false),
      ('Limpieza facial',            'limpieza-facial',           'faciales',         true),
      ('Microdermoabrasión',         'microdermoabrasion',        'faciales',         false),
      ('Hidrafacial',                'hidrafacial',               'faciales',         false),
      ('Radiofrecuencia facial',     'radiofrecuencia-facial',    'faciales',         false),
      ('Dermapen',                   'dermapen',                  'faciales',         false),
      ('PDRN de salmón',             'pdrn-de-salmon',            'faciales',         false),
      ('Hollywood peel',             'hollywood-peel',            'faciales',         true),
      ('Depilación láser corporal',  'depilacion-laser-corporal', 'depilacion-laser', false),
      ('Depilación láser facial',    'depilacion-laser-facial',   'depilacion-laser', false)
    ) as requested(name,slug,category_slug,featured)
  loop
    select id into strict v_category_id
      from public.treatment_categories where slug = r.category_slug;

    -- Preferir el identificador existente para preservar referencias a citas/planes.
    select id into v_treatment_id from public.treatments
      where slug = r.slug
         or (r.slug = 'hidrafacial' and slug = 'hydrafacial')
      order by case when slug = r.slug then 0 else 1 end
      limit 1;

    if v_treatment_id is null then
      select id into v_treatment_id from public.treatments
      where translate(lower(trim(name)), 'áéíóúüñ', 'aeiouun') =
            translate(lower(r.name), 'áéíóúüñ', 'aeiouun')
         or (r.slug = 'hidrafacial' and lower(trim(name)) = 'hydrafacial')
      limit 1;
    end if;

    if v_treatment_id is null then
      insert into public.treatments (
        name, slug, category_id, base_price, default_duration_minutes,
        default_session_count, is_featured, is_active, catalog_details_pending
      ) values (
        r.name, r.slug, v_category_id, 0, 60,
        1, r.featured, true, true
      );
    else
      update public.treatments set
        name = r.name,
        category_id = v_category_id,
        is_featured = r.featured,
        is_active = true
      where id = v_treatment_id;
      -- No tocar precio, duración, sesiones, disponibilidad ni histórico existentes.
    end if;
  end loop;
end;
$$;

commit;
