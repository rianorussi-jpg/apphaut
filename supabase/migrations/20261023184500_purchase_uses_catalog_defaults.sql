-- HAUT Clinical: la venta por WhatsApp reutiliza sesiones/duración de la ficha del tratamiento.
-- Si alguno de esos datos no está capturado, la solicitud se guarda como "Por confirmar"
-- y recepción lo completa únicamente al momento de asignar el tratamiento.

begin;

-- La configuración de venta ya no exige una configuración separada.
alter table public.treatments
  drop constraint if exists treatments_purchase_request_configuration_complete,
  drop constraint if exists treatments_purchase_sessions_allowed,
  drop constraint if exists treatments_purchase_duration_allowed;

alter table public.treatments
  add constraint treatments_purchase_sessions_positive
    check (purchase_session_count is null or purchase_session_count > 0),
  add constraint treatments_purchase_duration_positive
    check (purchase_duration_minutes is null or purchase_duration_minutes > 0);

comment on column public.treatments.purchase_session_count is
  'Copia de las sesiones de referencia usada para solicitudes de compra. Puede ser null y quedar Por confirmar.';
comment on column public.treatments.purchase_duration_minutes is
  'Copia de la duración de referencia usada para solicitudes de compra. Puede ser null y quedar Por confirmar.';

-- Para tratamientos vendidos actualmente, la configuración de compra pasa a tomar
-- los datos generales de la ficha. Si la ficha estaba pendiente, se deja por confirmar.
update public.treatments
set purchase_session_count = case
      when is_sold_in_app and not catalog_details_pending then default_session_count
      else null
    end,
    purchase_duration_minutes = case
      when is_sold_in_app and not catalog_details_pending then default_duration_minutes
      else null
    end
where is_sold_in_app;

-- Una solicitud puede llegar sin sesiones y/o duración.
alter table public.treatment_purchase_requests
  alter column session_count drop not null,
  alter column duration_minutes drop not null;

alter table public.treatment_purchase_requests
  drop constraint if exists treatment_purchase_requests_session_count_check,
  drop constraint if exists treatment_purchase_requests_duration_minutes_check,
  drop constraint if exists treatment_purchase_requests_session_count_positive,
  drop constraint if exists treatment_purchase_requests_duration_minutes_positive;

alter table public.treatment_purchase_requests
  add constraint treatment_purchase_requests_session_count_positive
    check (session_count is null or session_count > 0),
  add constraint treatment_purchase_requests_duration_minutes_positive
    check (duration_minutes is null or duration_minutes > 0);

-- Cliente: crea la solicitud aunque la ficha todavía tenga datos por confirmar.
create or replace function public.request_treatment_purchase(p_treatment_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_t public.treatments%rowtype;
  v_profile public.profiles%rowtype;
  v_existing_id uuid;
  v_request_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Inicia sesión para solicitar este tratamiento.' using errcode='42501';
  end if;

  if exists (select 1 from public.user_roles r where r.user_id=auth.uid()) then
    raise exception 'Esta acción está disponible únicamente para clientes.' using errcode='42501';
  end if;

  select * into strict v_profile
  from public.profiles
  where id=auth.uid();

  if v_profile.preferred_branch_id is null then
    raise exception 'Selecciona una sucursal en tu perfil antes de solicitar la compra.';
  end if;

  select * into strict v_t
  from public.treatments
  where id=p_treatment_id and is_active and is_sold_in_app;

  if not exists (
    select 1
    from public.treatment_branches tb
    join public.branches b on b.id=tb.branch_id and b.is_active
    where tb.treatment_id=v_t.id
      and tb.branch_id=v_profile.preferred_branch_id
      and tb.is_active
  ) then
    raise exception 'Este tratamiento no está disponible en tu sucursal seleccionada.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':' || p_treatment_id::text, 0));

  if exists (
    select 1 from public.client_treatment_plans p
    where p.client_id=auth.uid()
      and p.treatment_id=p_treatment_id
      and p.status in ('active','paused')
  ) then
    raise exception 'Este tratamiento ya forma parte de tus tratamientos.';
  end if;

  select r.id into v_existing_id
  from public.treatment_purchase_requests r
  where r.user_id=auth.uid()
    and r.treatment_id=p_treatment_id
    and r.status in ('pending','contacted')
  order by r.created_at desc
  limit 1;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  insert into public.treatment_purchase_requests (
    user_id,treatment_id,branch_id,status,session_count,duration_minutes,quoted_amount
  ) values (
    auth.uid(),v_t.id,v_profile.preferred_branch_id,'pending',
    v_t.purchase_session_count,v_t.purchase_duration_minutes,v_t.base_price
  ) returning id into v_request_id;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
  values (
    auth.uid(),'request_treatment_purchase','treatment_purchase_request',v_request_id,
    jsonb_build_object(
      'treatment_id',v_t.id,
      'branch_id',v_profile.preferred_branch_id,
      'session_count',v_t.purchase_session_count,
      'duration_minutes',v_t.purchase_duration_minutes,
      'quoted_amount',v_t.base_price,
      'source','client_app'
    )
  );

  return v_request_id;
end;
$$;

revoke all on function public.request_treatment_purchase(uuid) from public, anon;
grant execute on function public.request_treatment_purchase(uuid) to authenticated;

-- Reemplaza la versión anterior: recepción puede completar solo los datos que faltaban.
drop function if exists public.admin_assign_purchase_request(uuid,integer,integer);

create function public.admin_assign_purchase_request(
  p_request_id uuid,
  p_session_count integer,
  p_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.treatment_purchase_requests%rowtype;
  v_t public.treatments%rowtype;
  v_plan_id uuid;
  v_sessions integer;
  v_duration integer;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tienes permiso para asignar compras.' using errcode='42501';
  end if;

  select * into strict v_request
  from public.treatment_purchase_requests
  where id=p_request_id
  for update;

  if not public.can_access_branch(v_request.branch_id) then
    raise exception 'No tienes acceso a la sucursal de esta solicitud.' using errcode='42501';
  end if;

  if v_request.status='assigned' and v_request.plan_id is not null then
    return v_request.plan_id;
  end if;
  if v_request.status='cancelled' then
    raise exception 'La solicitud está cancelada.';
  end if;

  v_sessions := coalesce(v_request.session_count,p_session_count);
  v_duration := coalesce(v_request.duration_minutes,p_duration_minutes);

  if v_sessions is null or v_sessions < 1 then
    raise exception 'Define cuántas sesiones tendrá el tratamiento antes de asignarlo.';
  end if;
  if v_duration is null or v_duration < 1 then
    raise exception 'Define la duración por sesión antes de asignar el tratamiento.';
  end if;

  select * into strict v_t
  from public.treatments
  where id=v_request.treatment_id and is_active;

  if not exists (
    select 1 from public.treatment_branches tb
    where tb.treatment_id=v_request.treatment_id
      and tb.branch_id=v_request.branch_id
      and tb.is_active
  ) then
    raise exception 'El tratamiento ya no está disponible en la sucursal de la solicitud.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_request.user_id::text || ':' || v_request.treatment_id::text, 0));

  if exists (
    select 1 from public.client_treatment_plans p
    where p.client_id=v_request.user_id
      and p.treatment_id=v_request.treatment_id
      and p.status in ('active','paused')
  ) then
    raise exception 'El cliente ya tiene un plan activo de este tratamiento.';
  end if;

  insert into public.client_treatment_plans (
    client_id,treatment_id,default_branch_id,total_sessions,
    recommended_interval_days,minimum_interval_days,maximum_interval_days,
    status,started_at,created_by,internal_notes
  ) values (
    v_request.user_id,v_request.treatment_id,v_request.branch_id,v_sessions,
    v_t.recommended_interval_days,v_t.minimum_interval_days,v_t.maximum_interval_days,
    'active',now(),auth.uid(),
    'Tratamiento asignado desde una solicitud de compra de la app. Primera cita pendiente de programación por HAUT.'
  ) returning id into v_plan_id;

  insert into public.treatment_plan_sessions(plan_id,session_number,planned_duration_minutes,status)
  select v_plan_id,i,v_duration,
    case when i=1 then 'available'::public.treatment_session_status else 'locked'::public.treatment_session_status end
  from generate_series(1,v_sessions) as i;

  update public.treatment_purchase_requests
  set status='assigned',
      session_count=v_sessions,
      duration_minutes=v_duration,
      plan_id=v_plan_id,
      contacted_at=coalesce(contacted_at,now()),
      contacted_by=coalesce(contacted_by,auth.uid()),
      assigned_at=now(),
      assigned_by=auth.uid()
  where id=p_request_id;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
  values (
    auth.uid(),'assign_purchase_request','client_treatment_plan',v_plan_id,
    jsonb_build_object(
      'purchase_request_id',p_request_id,
      'client_id',v_request.user_id,
      'treatment_id',v_request.treatment_id,
      'branch_id',v_request.branch_id,
      'session_count',v_sessions,
      'duration_minutes',v_duration,
      'source','purchase_request'
    )
  );

  return v_plan_id;
end;
$$;

revoke all on function public.admin_assign_purchase_request(uuid,integer,integer) from public, anon;
grant execute on function public.admin_assign_purchase_request(uuid,integer,integer) to authenticated;

-- Mantiene compatibilidad con cualquier panel anterior que todavía llame la RPC con un solo argumento.
create or replace function public.admin_assign_purchase_request(p_request_id uuid)
returns uuid
language sql
security definer
set search_path = ''
as $$
  select public.admin_assign_purchase_request(p_request_id,null::integer,null::integer);
$$;

revoke all on function public.admin_assign_purchase_request(uuid) from public, anon;
grant execute on function public.admin_assign_purchase_request(uuid) to authenticated;

commit;
