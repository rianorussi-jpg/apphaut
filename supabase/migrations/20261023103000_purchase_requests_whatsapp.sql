-- HAUT Clinical: solicitudes de compra atendidas por WhatsApp.
-- Mantiene Paquetes y la casilla "Vender en la app", pero elimina cualquier cobro automático.
-- Al tocar Comprar, el cliente crea una solicitud. Recepción contacta por WhatsApp y asigna el plan sin cita.

begin;

-- Limpieza segura de la implementación anterior de cobro automático, si llegó a aplicarse.
drop function if exists public.complete_treatment_purchase(uuid,text,text,text,text);
drop table if exists public.treatment_purchases cascade;

-- Estos campos siguen siendo útiles para controlar catálogo, paquetes y la configuración
-- del plan que recepción asignará después de concretar la compra.
alter table public.treatments
  add column if not exists is_sold_in_app boolean not null default false,
  add column if not exists is_package boolean not null default false,
  add column if not exists purchase_session_count integer,
  add column if not exists purchase_duration_minutes integer;

comment on column public.treatments.is_sold_in_app is
  'Muestra el botón Comprar. Al tocarlo se crea una solicitud para seguimiento por WhatsApp; no se realiza un cobro automático.';
comment on column public.treatments.is_package is
  'Muestra el tratamiento en la sección Paquetes de Inicio y lo excluye del listado normal de Tratamientos.';
comment on column public.treatments.purchase_session_count is
  'Sesiones del plan que recepción asigna cuando concreta una solicitud de compra.';
comment on column public.treatments.purchase_duration_minutes is
  'Duración base por sesión del plan que recepción asigna cuando concreta una solicitud de compra.';

-- Si existían las restricciones de la versión anterior, conservar reglas útiles pero
-- reemplazar la que hablaba de venta/pago automático.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='treatments_purchase_sessions_allowed') then
    alter table public.treatments add constraint treatments_purchase_sessions_allowed
      check (purchase_session_count is null or purchase_session_count in (1,3,5,8,10));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname='treatments_purchase_duration_allowed') then
    alter table public.treatments add constraint treatments_purchase_duration_allowed
      check (purchase_duration_minutes is null or purchase_duration_minutes in (15,30,45,60,85));
  end if;
end $$;

alter table public.treatments drop constraint if exists treatments_sale_configuration_complete;
alter table public.treatments drop constraint if exists treatments_purchase_request_configuration_complete;
alter table public.treatments add constraint treatments_purchase_request_configuration_complete
  check (
    not is_sold_in_app
    or (
      base_price > 0
      and purchase_session_count is not null
      and purchase_duration_minutes is not null
    )
  );

create table if not exists public.treatment_purchase_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  plan_id uuid references public.client_treatment_plans(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','contacted','assigned','cancelled')),
  session_count integer not null check (session_count in (1,3,5,8,10)),
  duration_minutes integer not null check (duration_minutes in (15,30,45,60,85)),
  quoted_amount numeric(12,2) not null default 0 check (quoted_amount >= 0),
  contacted_at timestamptz,
  contacted_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treatment_purchase_requests_user_idx
  on public.treatment_purchase_requests(user_id, created_at desc);
create index if not exists treatment_purchase_requests_status_idx
  on public.treatment_purchase_requests(status, created_at desc);
create index if not exists treatment_purchase_requests_branch_idx
  on public.treatment_purchase_requests(branch_id, status, created_at desc);
create unique index if not exists treatment_purchase_requests_one_open_idx
  on public.treatment_purchase_requests(user_id, treatment_id)
  where status in ('pending','contacted');

alter table public.treatment_purchase_requests enable row level security;

drop policy if exists treatment_purchase_requests_owner_read on public.treatment_purchase_requests;
create policy treatment_purchase_requests_owner_read
  on public.treatment_purchase_requests for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists treatment_purchase_requests_staff_read on public.treatment_purchase_requests;
create policy treatment_purchase_requests_staff_read
  on public.treatment_purchase_requests for select
  to authenticated
  using (
    public.current_app_role() = 'superadmin'
    or public.can_access_branch(branch_id)
  );

revoke insert, update, delete on public.treatment_purchase_requests from anon, authenticated;
grant select on public.treatment_purchase_requests to authenticated;

drop trigger if exists treatment_purchase_requests_set_updated_at on public.treatment_purchase_requests;
create trigger treatment_purchase_requests_set_updated_at
  before update on public.treatment_purchase_requests
  for each row execute function public.set_updated_at();

-- Cliente: crea (o reutiliza) su solicitud. No cobra, no crea plan y no crea cita.
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

  if v_t.purchase_session_count is null or v_t.purchase_duration_minutes is null then
    raise exception 'La configuración de compra de este tratamiento está incompleta.';
  end if;

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

-- Admin/recepción: marca que ya se inició el contacto por WhatsApp.
create or replace function public.admin_mark_purchase_request_contacted(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.treatment_purchase_requests%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tienes permiso para gestionar compras.' using errcode='42501';
  end if;

  select * into strict v_request
  from public.treatment_purchase_requests
  where id=p_request_id
  for update;

  if not public.can_access_branch(v_request.branch_id) then
    raise exception 'No tienes acceso a la sucursal de esta solicitud.' using errcode='42501';
  end if;

  if v_request.status='assigned' then
    return;
  end if;
  if v_request.status='cancelled' then
    raise exception 'La solicitud está cancelada.';
  end if;

  update public.treatment_purchase_requests
  set status='contacted',
      contacted_at=coalesce(contacted_at,now()),
      contacted_by=coalesce(contacted_by,auth.uid())
  where id=p_request_id;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
  values (auth.uid(),'contact_purchase_request','treatment_purchase_request',p_request_id,
    jsonb_build_object('status','contacted'));
end;
$$;

revoke all on function public.admin_mark_purchase_request_contacted(uuid) from public, anon;
grant execute on function public.admin_mark_purchase_request_contacted(uuid) to authenticated;

-- Admin/recepción: asigna el tratamiento solicitado con la configuración capturada
-- al momento de solicitarlo. No crea cita.
create or replace function public.admin_assign_purchase_request(p_request_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.treatment_purchase_requests%rowtype;
  v_t public.treatments%rowtype;
  v_plan_id uuid;
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
    v_request.user_id,v_request.treatment_id,v_request.branch_id,v_request.session_count,
    v_t.recommended_interval_days,v_t.minimum_interval_days,v_t.maximum_interval_days,
    'active',now(),auth.uid(),
    'Tratamiento asignado desde una solicitud de compra de la app. Primera cita pendiente de programación por HAUT.'
  ) returning id into v_plan_id;

  insert into public.treatment_plan_sessions(plan_id,session_number,planned_duration_minutes,status)
  select v_plan_id,i,v_request.duration_minutes,
    case when i=1 then 'available'::public.treatment_session_status else 'locked'::public.treatment_session_status end
  from generate_series(1,v_request.session_count) as i;

  update public.treatment_purchase_requests
  set status='assigned',
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
      'session_count',v_request.session_count,
      'duration_minutes',v_request.duration_minutes,
      'source','purchase_request'
    )
  );

  return v_plan_id;
end;
$$;

revoke all on function public.admin_assign_purchase_request(uuid) from public, anon;
grant execute on function public.admin_assign_purchase_request(uuid) to authenticated;

commit;
