-- HAUT Clinical: nota informativa visible para cliente y recepción.
-- Es independiente de las notas internas de citas/planes y se conserva durante todo el plan.

begin;

alter table public.client_treatment_plans
  add column if not exists informative_note text;

comment on column public.client_treatment_plans.informative_note is
  'Nota informativa opcional del plan, visible para el cliente y para el personal al agendar citas. Conserva saltos de línea.';

create or replace function public.admin_set_plan_informative_note(
  p_plan_id uuid,
  p_informative_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_branch_id uuid;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tienes permiso para editar esta nota.' using errcode='42501';
  end if;

  select p.default_branch_id
  into v_branch_id
  from public.client_treatment_plans p
  where p.id=p_plan_id;

  if not found then
    raise exception 'No se encontró el tratamiento asignado.';
  end if;

  if v_branch_id is not null and not public.can_access_branch(v_branch_id) then
    raise exception 'No tienes acceso a la sucursal de este tratamiento.' using errcode='42501';
  end if;

  update public.client_treatment_plans
  set informative_note=nullif(pg_catalog.btrim(coalesce(p_informative_note,'')), '')
  where id=p_plan_id;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
  values (
    auth.uid(),'update_plan_informative_note','client_treatment_plan',p_plan_id,
    jsonb_build_object('informative_note',nullif(pg_catalog.btrim(coalesce(p_informative_note,'')), ''))
  );
end;
$$;

revoke all on function public.admin_set_plan_informative_note(uuid,text) from public, anon;
grant execute on function public.admin_set_plan_informative_note(uuid,text) to authenticated;

commit;
