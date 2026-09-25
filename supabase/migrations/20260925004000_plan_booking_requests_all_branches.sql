-- HAUT: continuidad de planes, WhatsApp por sucursal y disponibilidad global.
-- Ejecutar una sola vez después de las migraciones anteriores.
begin;

-- Todos los tratamientos activos quedan disponibles en todas las sucursales activas.
insert into public.treatment_branches (
  treatment_id,
  branch_id,
  is_active,
  price_override,
  duration_override_minutes
)
select t.id, b.id, true, null, null
from public.treatments t
cross join public.branches b
where t.is_active and b.is_active
on conflict (treatment_id, branch_id) do update
set is_active = true;

-- La agenda necesita al menos una cabina compatible. Solo cuando una combinación
-- tratamiento+sucursal no tiene ninguna compatibilidad definida, habilitamos todas
-- las cabinas activas de esa sucursal como valor inicial. Las configuraciones
-- específicas ya existentes se respetan.
insert into public.treatment_cabins (treatment_id, branch_id, cabin_id)
select tb.treatment_id, tb.branch_id, c.id
from public.treatment_branches tb
join public.cabins c
  on c.branch_id = tb.branch_id
 and c.is_active
where tb.is_active
  and not exists (
    select 1
    from public.treatment_cabins existing
    where existing.treatment_id = tb.treatment_id
      and existing.branch_id = tb.branch_id
  )
on conflict do nothing;

-- Permite mantener desde Admin el número de WhatsApp de cada sucursal.
create or replace function public.admin_update_branch_contact(
  p_branch_id uuid,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  if auth.uid() is null then
    raise exception 'Debes iniciar sesión.' using errcode = '42501';
  end if;

  v_role := public.current_app_role();
  if v_role is null or v_role not in ('superadmin', 'branch_admin') then
    raise exception 'No tienes permisos para editar la sucursal.' using errcode = '42501';
  end if;

  if not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a esta sucursal.' using errcode = '42501';
  end if;

  update public.branches
  set phone = nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''),
      updated_at = now()
  where id = p_branch_id;

  if not found then
    raise exception 'Sucursal no encontrada.';
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, new_data)
  values (
    auth.uid(),
    'branch.contact.updated',
    'branch',
    p_branch_id,
    pg_catalog.jsonb_build_object('phone', nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''))
  );
end;
$$;

revoke all on function public.admin_update_branch_contact(uuid, text) from public, anon;
grant execute on function public.admin_update_branch_contact(uuid, text) to authenticated;

commit;
