begin;

-- Preferred branch is chosen during registration, independently of any appointment.
alter table public.profiles
  add column if not exists preferred_branch_id uuid references public.branches(id) on delete set null;
create index if not exists profiles_preferred_branch_idx on public.profiles(preferred_branch_id);

-- The auth trigger stores validated registration metadata even when email
-- confirmation is enabled and signUp() has no session yet.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_branch uuid;
  v_raw_branch text;
  v_phone text;
begin
  v_raw_branch := new.raw_user_meta_data ->> 'preferred_branch_id';
  if v_raw_branch is not null and v_raw_branch ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    select id into v_branch from public.branches where id = v_raw_branch::uuid and is_active = true;
  end if;
  v_phone := nullif(trim(new.raw_user_meta_data ->> 'phone'), '');
  insert into public.profiles(id, full_name, phone, preferred_branch_id)
  values (new.id, nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), v_phone, v_branch)
  on conflict (id) do nothing;
  return new;
end;
$$;

create table public.promotions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(trim(title)) between 1 and 150),
  description text,
  image_url text,
  treatment_id uuid references public.treatments(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  check (starts_at is null or ends_at is null or starts_at < ends_at)
);
create index promotions_active_idx on public.promotions(is_active, sort_order);
alter table public.promotions enable row level security;
create policy promotions_client_select on public.promotions for select to authenticated
  using (is_active and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
    and (branch_id is null or exists (
      select 1 from public.profiles p where p.id = auth.uid() and p.preferred_branch_id = branch_id
    )));
create policy promotions_staff_select on public.promotions for select to authenticated
  using (public.is_staff());
create policy promotions_superadmin_insert on public.promotions for insert to authenticated
  with check (public.current_app_role() = 'superadmin');
create policy promotions_superadmin_update on public.promotions for update to authenticated
  using (public.current_app_role() = 'superadmin')
  with check (public.current_app_role() = 'superadmin');
create policy promotions_superadmin_delete on public.promotions for delete to authenticated
  using (public.current_app_role() = 'superadmin');

-- Single source of truth for rewards: a ledger, not a made-up balance in frontend.
create table public.client_reward_movements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  points integer not null check (points <> 0),
  description text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index reward_movements_client_idx on public.client_reward_movements(client_id, created_at desc);
alter table public.client_reward_movements enable row level security;
create policy rewards_owner_select on public.client_reward_movements for select to authenticated
  using (client_id = auth.uid());
create policy rewards_staff_select on public.client_reward_movements for select to authenticated
  using (public.current_app_role() = 'superadmin' or exists (
    select 1 from public.profiles p where p.id = client_id
    and p.preferred_branch_id is not null and public.can_access_branch(p.preferred_branch_id)
  ));

-- Restrict branch employees to customers they actually serve, rather than
-- allowing every staff account to enumerate every profile in the company.
drop policy if exists profiles_staff_select on public.profiles;
create policy profiles_staff_select on public.profiles for select to authenticated
  using (public.current_app_role()='superadmin'
    or (preferred_branch_id is not null and public.can_access_branch(preferred_branch_id))
    or exists (
      select 1 from public.client_treatment_plans pl
      where pl.client_id = id and pl.default_branch_id is not null
      and public.can_access_branch(pl.default_branch_id)
    ));

-- The booking selector previously listed all clients to all staff; scope it.
create or replace function public.admin_booking_clients()
returns table (id uuid, full_name text, phone text, email text)
language plpgsql stable security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.is_staff() then
   raise exception 'No tienes permisos para consultar clientes.' using errcode='42501';
 end if;
 return query
 select p.id, coalesce(nullif(p.full_name,''),u.email,'Cliente') as full_name,
 p.phone, u.email
 from public.profiles p
 join auth.users u on u.id=p.id
 left join public.user_roles ur on ur.user_id=p.id
 where ur.user_id is null
 and (public.current_app_role()='superadmin'
      or (p.preferred_branch_id is not null and public.can_access_branch(p.preferred_branch_id))
      or exists (select 1 from public.client_treatment_plans pl
          where pl.client_id=p.id and pl.default_branch_id is not null
          and public.can_access_branch(pl.default_branch_id)))
 order by coalesce(nullif(p.full_name,''),u.email,'Cliente');
end;
$$;
revoke all on function public.admin_booking_clients() from public;
grant execute on function public.admin_booking_clients() to authenticated;

-- Assign a plan without creating an appointment; booking remains admin-only.
create or replace function public.admin_assign_treatment_plan(
  p_client_id uuid,
  p_treatment_id uuid,
  p_branch_id uuid,
  p_total_sessions integer default null
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_t public.treatments%rowtype;
  v_branch public.treatment_branches%rowtype;
  v_plan_id uuid;
  v_count integer;
  v_duration integer;
begin
  if auth.uid() is null or not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes permiso para asignar tratamientos a esta sucursal.' using errcode='42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_client_id)
     or exists (select 1 from public.user_roles r where r.user_id = p_client_id) then
    raise exception 'Cliente no válido.';
  end if;
  if public.current_app_role() <> 'superadmin' and not exists (
    select 1 from public.profiles p where p.id=p_client_id
    and p.preferred_branch_id=p_branch_id
  ) then raise exception 'El cliente pertenece a otra sucursal.' using errcode='42501'; end if;
  select * into strict v_t from public.treatments where id = p_treatment_id and is_active;
  select * into strict v_branch from public.treatment_branches
    where treatment_id = p_treatment_id and branch_id = p_branch_id and is_active;
  v_count := coalesce(p_total_sessions, v_t.default_session_count);
  if v_count < 1 or v_count > 200 then raise exception 'El número de sesiones debe estar entre 1 y 200.'; end if;
  v_duration := coalesce(v_branch.duration_override_minutes, v_t.default_duration_minutes);
  -- prevent accidentally assigning a second active plan for the same treatment
  perform pg_advisory_xact_lock(hashtextextended(p_client_id::text || ':' || p_treatment_id::text, 0));
  if exists (select 1 from public.client_treatment_plans p
    where p.client_id = p_client_id and p.treatment_id = p_treatment_id and p.status in ('active','paused')) then
    raise exception 'El cliente ya tiene un plan activo de este tratamiento.';
  end if;
  insert into public.client_treatment_plans (
    client_id, treatment_id, default_branch_id, total_sessions, recommended_interval_days,
    minimum_interval_days, maximum_interval_days, status, started_at, created_by
  ) values (
    p_client_id, p_treatment_id, p_branch_id, v_count, v_t.recommended_interval_days,
    v_t.minimum_interval_days, v_t.maximum_interval_days, 'active', now(), auth.uid()
  ) returning id into v_plan_id;
  insert into public.treatment_plan_sessions(plan_id, session_number, planned_duration_minutes, status)
    select v_plan_id, i, v_duration,
      case when i = 1 then 'available'::public.treatment_session_status else 'locked'::public.treatment_session_status end
    from generate_series(1, v_count) as i;
  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, new_data)
    values (auth.uid(), 'assign_treatment_plan', 'client_treatment_plan', v_plan_id,
      jsonb_build_object('client_id',p_client_id,'treatment_id',p_treatment_id,'total_sessions',v_count));
  return v_plan_id;
end;
$$;
revoke all on function public.admin_assign_treatment_plan(uuid,uuid,uuid,integer) from public;
grant execute on function public.admin_assign_treatment_plan(uuid,uuid,uuid,integer) to authenticated;

create or replace function public.admin_add_reward_points(
  p_client_id uuid,
  p_points integer,
  p_description text
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if auth.uid() is null or not public.is_staff() then raise exception 'Acceso denegado.' using errcode='42501'; end if;
  if public.current_app_role() <> 'superadmin' and not exists (
    select 1 from public.profiles p where p.id = p_client_id
    and p.preferred_branch_id is not null and public.can_access_branch(p.preferred_branch_id)
  ) then raise exception 'Cliente fuera de tu sucursal.' using errcode='42501'; end if;
  if p_points = 0 or abs(p_points) > 100000 then raise exception 'Cantidad de puntos no válida.'; end if;
  if length(trim(coalesce(p_description,''))) < 3 then raise exception 'Indica un motivo.'; end if;
  if not exists (select 1 from public.profiles where id = p_client_id) then raise exception 'Cliente no encontrado.'; end if;
  insert into public.client_reward_movements(client_id, points, description, created_by)
    values (p_client_id, p_points, trim(p_description), auth.uid()) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.admin_add_reward_points(uuid,integer,text) from public;
grant execute on function public.admin_add_reward_points(uuid,integer,text) to authenticated;

-- A separate aggregate avoids misreporting a balance when a client has many movements.
create or replace function public.client_reward_balance()
returns bigint language sql stable security invoker set search_path = '' as $$
  select coalesce(sum(points),0)::bigint from public.client_reward_movements
  where client_id=auth.uid();
$$;
revoke all on function public.client_reward_balance() from public;
grant execute on function public.client_reward_balance() to authenticated;

-- Superadmin can maintain the real treatment catalogue and its compatibility map.
create policy treatments_superadmin_insert on public.treatments for insert to authenticated
  with check (public.current_app_role() = 'superadmin');
create policy treatments_superadmin_update on public.treatments for update to authenticated
  using (public.current_app_role() = 'superadmin')
  with check (public.current_app_role() = 'superadmin');
create policy treatment_branches_superadmin_insert on public.treatment_branches for insert to authenticated
  with check (public.current_app_role() = 'superadmin');
create policy treatment_branches_superadmin_update on public.treatment_branches for update to authenticated
  using (public.current_app_role() = 'superadmin')
  with check (public.current_app_role() = 'superadmin');
create policy treatment_cabins_superadmin_insert on public.treatment_cabins for insert to authenticated
  with check (public.current_app_role() = 'superadmin');
create policy treatment_cabins_superadmin_delete on public.treatment_cabins for delete to authenticated
  using (public.current_app_role() = 'superadmin');

-- Staff action changes an appointment and its session in one transaction.
-- The client only has SELECT access and cannot call this operation successfully.
create or replace function public.admin_set_appointment_status(
  p_appointment_id uuid,
  p_status public.appointment_status
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_a public.appointments%rowtype;
  v_s public.treatment_plan_sessions%rowtype;
  v_plan public.client_treatment_plans%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tienes permisos para actualizar citas.' using errcode='42501';
  end if;
  select * into v_a from public.appointments where id=p_appointment_id for update;
  if not found then raise exception 'Cita no encontrada.'; end if;
  if not public.can_access_branch(v_a.branch_id) then
    raise exception 'No tienes acceso a esta sucursal.' using errcode='42501';
  end if;
  if v_a.status in ('completed','cancelled','no_show') then
    raise exception 'Una cita finalizada, cancelada o no asistida no se puede volver a cambiar.';
  end if;
  if p_status not in ('confirmed','arrived','completed','cancelled','no_show') then
    raise exception 'Estado de cita no permitido.';
  end if;
  select * into strict v_s from public.treatment_plan_sessions where id=v_a.plan_session_id for update;
  select * into strict v_plan from public.client_treatment_plans where id=v_s.plan_id for update;
  if v_s.status <> 'scheduled' then raise exception 'La sesión no se encuentra agendada.'; end if;
  update public.appointments set status=p_status,
    completed_at=case when p_status='completed' then now() else completed_at end,
    cancelled_at=case when p_status='cancelled' then now() else cancelled_at end,
    checked_in_at=case when p_status='arrived' then now() else checked_in_at end
    where id=v_a.id;
  if p_status='completed' then
    update public.treatment_plan_sessions set status='completed', completed_at=now() where id=v_s.id;
    update public.client_treatment_plans set started_at=coalesce(started_at,now()) where id=v_plan.id;
    if v_s.session_number < v_plan.total_sessions then
      update public.treatment_plan_sessions set status='available'
      where plan_id=v_plan.id and session_number=v_s.session_number+1 and status='locked';
    else
      update public.client_treatment_plans set status='completed',completed_at=now() where id=v_plan.id;
    end if;
  elsif p_status in ('cancelled','no_show') then
    update public.treatment_plan_sessions set status='available' where id=v_s.id;
  end if;
  insert into public.appointment_status_history(appointment_id,from_status,to_status,changed_by)
  values (v_a.id,v_a.status,p_status,auth.uid());
  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,old_data,new_data)
  values (auth.uid(),'update_appointment_status','appointment',v_a.id,
    jsonb_build_object('status',v_a.status),jsonb_build_object('status',p_status));
end;
$$;
revoke all on function public.admin_set_appointment_status(uuid,public.appointment_status) from public;
grant execute on function public.admin_set_appointment_status(uuid,public.appointment_status) to authenticated;

commit;
