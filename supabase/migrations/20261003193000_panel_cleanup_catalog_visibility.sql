-- HAUT Clinical: limpieza de Rewards y control independiente de visibilidad del catálogo.
-- Un tratamiento oculto del catálogo sigue activo para agenda, asignaciones y planes.

alter table public.treatments
  add column if not exists is_catalog_visible boolean not null default true;

comment on column public.treatments.is_catalog_visible is
  'Controla únicamente la exposición del tratamiento en el catálogo de la app cliente. No determina si puede asignarse o agendarse.';

-- HAUT no utiliza un programa de puntos/rewards.
drop function if exists public.admin_add_reward_points(uuid, integer, text);
drop function if exists public.client_reward_balance();
drop table if exists public.client_reward_movements cascade;
