-- HAUT: corrección incremental de directorio y permisos del catálogo.
-- No elimina perfiles, citas, planes ni tratamientos.
begin;

-- Repara únicamente perfiles ausentes de usuarios Auth ya existentes.
insert into public.profiles (id, full_name, phone)
select u.id,
       coalesce(nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), split_part(u.email, '@', 1), 'Cliente'),
       nullif(btrim(u.raw_user_meta_data ->> 'phone'), '')
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- Auth contiene el correo; LEFT JOIN evita perder clientes si hay diferencias
-- temporales entre tablas y excluye del selector a las cuentas del personal.
create or replace function public.admin_booking_clients()
returns table (id uuid, full_name text, phone text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tienes permisos para consultar clientes.' using errcode = '42501';
  end if;
  return query
  select p.id,
         coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''), u.email, 'Cliente')::text,
         coalesce(p.phone, nullif(btrim(u.raw_user_meta_data ->> 'phone'), ''))::text,
         u.email::text
  from public.profiles p
  left join auth.users u on u.id = p.id
  where not exists (select 1 from public.user_roles ur where ur.user_id = p.id)
    and (
      public.current_app_role() = 'superadmin'
      or (p.preferred_branch_id is not null and public.can_access_branch(p.preferred_branch_id))
      or exists (
        select 1 from public.client_treatment_plans pl
        where pl.client_id = p.id and pl.default_branch_id is not null
          and public.can_access_branch(pl.default_branch_id)
      )
      or exists (
        select 1 from public.appointments a
        join public.treatment_plan_sessions s on s.id = a.plan_session_id
        join public.client_treatment_plans pl on pl.id = s.plan_id
        where pl.client_id = p.id and public.can_access_branch(a.branch_id)
      )
    )
  order by 2, 1;
end;
$$;
revoke all on function public.admin_booking_clients() from public, anon;
grant execute on function public.admin_booking_clients() to authenticated;

-- El editor antiguo intentaba writes directos sin políticas INSERT/UPDATE.
-- Solo superadmin puede gestionar el catálogo; las lecturas públicas se mantienen.
drop policy if exists haut_treatments_admin_insert on public.treatments;
create policy haut_treatments_admin_insert on public.treatments for insert to authenticated
with check (public.current_app_role() = 'superadmin');
drop policy if exists haut_treatments_admin_update on public.treatments;
create policy haut_treatments_admin_update on public.treatments for update to authenticated
using (public.current_app_role() = 'superadmin')
with check (public.current_app_role() = 'superadmin');

drop policy if exists haut_treatment_branches_admin_insert on public.treatment_branches;
create policy haut_treatment_branches_admin_insert on public.treatment_branches for insert to authenticated
with check (public.current_app_role() = 'superadmin');
drop policy if exists haut_treatment_branches_admin_update on public.treatment_branches;
create policy haut_treatment_branches_admin_update on public.treatment_branches for update to authenticated
using (public.current_app_role() = 'superadmin')
with check (public.current_app_role() = 'superadmin');
drop policy if exists haut_treatment_branches_admin_delete on public.treatment_branches;
create policy haut_treatment_branches_admin_delete on public.treatment_branches for delete to authenticated
using (public.current_app_role() = 'superadmin');

drop policy if exists haut_treatment_cabins_admin_insert on public.treatment_cabins;
create policy haut_treatment_cabins_admin_insert on public.treatment_cabins for insert to authenticated
with check (public.current_app_role() = 'superadmin');
drop policy if exists haut_treatment_cabins_admin_delete on public.treatment_cabins;
create policy haut_treatment_cabins_admin_delete on public.treatment_cabins for delete to authenticated
using (public.current_app_role() = 'superadmin');

-- treatment-images ya se creó con las primeras migraciones y tiene reglas
-- de lectura pública y subida para personal autenticado; no duplicar el bucket.
commit;
