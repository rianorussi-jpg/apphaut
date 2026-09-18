begin;

-- Booking helpers used by the administrative calendar.
-- These functions keep inserts behind the database so RLS remains strict and
-- the cabin/session rules are validated server-side.

create or replace function public.admin_booking_clients()
returns table (
  id uuid,
  full_name text,
  phone text,
  email text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tienes permisos para consultar clientes.' using errcode = '42501';
  end if;

  return query
  select
    p.id,
    coalesce(nullif(p.full_name, ''), u.email, 'Cliente') as full_name,
    p.phone,
    u.email
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.user_roles ur on ur.user_id = p.id
  where ur.user_id is null
  order by coalesce(nullif(p.full_name, ''), u.email, 'Cliente');
end;
$$;

grant execute on function public.admin_booking_clients() to authenticated;

create or replace function public.admin_create_appointment(
  p_client_id uuid,
  p_treatment_id uuid,
  p_branch_id uuid,
  p_date date,
  p_time time,
  p_preferred_cabin_id uuid default null,
  p_internal_notes text default null
)
returns table (
  appointment_id uuid,
  plan_id uuid,
  plan_session_id uuid,
  cabin_id uuid,
  cabin_name text,
  session_number integer,
  total_sessions integer,
  starts_at timestamptz,
  ends_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_timezone text;
  v_default_sessions integer;
  v_duration integer;
  v_price numeric(12,2);
  v_recommended integer;
  v_minimum integer;
  v_maximum integer;
  v_plan public.client_treatment_plans%rowtype;
  v_session public.treatment_plan_sessions%rowtype;
  v_previous_completed_at timestamptz;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_local_start timestamp without time zone;
  v_local_end timestamp without time zone;
  v_weekday integer;
  v_has_hours boolean;
  v_has_exceptions boolean;
  v_cabin record;
  v_appointment_id uuid;
  v_i integer;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tienes permisos para crear citas.' using errcode = '42501';
  end if;

  if not public.can_access_branch(p_branch_id) then
    raise exception 'No tienes acceso a esta sucursal.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles p where p.id = p_client_id) then
    raise exception 'El cliente seleccionado no existe.';
  end if;

  select b.timezone
  into v_timezone
  from public.branches b
  where b.id = p_branch_id and b.is_active;

  if not found then
    raise exception 'La sucursal seleccionada no está disponible.';
  end if;

  select
    t.default_session_count,
    coalesce(tb.duration_override_minutes, t.default_duration_minutes),
    coalesce(tb.price_override, t.base_price),
    t.recommended_interval_days,
    t.minimum_interval_days,
    t.maximum_interval_days
  into
    v_default_sessions,
    v_duration,
    v_price,
    v_recommended,
    v_minimum,
    v_maximum
  from public.treatments t
  join public.treatment_branches tb
    on tb.treatment_id = t.id
   and tb.branch_id = p_branch_id
   and tb.is_active
  where t.id = p_treatment_id
    and t.is_active;

  if not found then
    raise exception 'Este tratamiento no está disponible en la sucursal seleccionada.';
  end if;

  -- Serialize plan/session selection for this client+treatment pair.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_client_id::text || ':' || p_treatment_id::text, 0)
  );

  select p.*
  into v_plan
  from public.client_treatment_plans p
  where p.client_id = p_client_id
    and p.treatment_id = p_treatment_id
    and p.status in ('active', 'paused')
  order by p.created_at desc
  limit 1
  for update;

  if found then
    if v_plan.status = 'paused' then
      raise exception 'Este plan de tratamiento está pausado. Reactívalo antes de reservar otra sesión.';
    end if;

    if v_plan.default_branch_id is not null
       and not v_plan.allow_branch_change
       and v_plan.default_branch_id <> p_branch_id then
      raise exception 'Este plan está asignado a otra sucursal.';
    end if;

    select s.*
    into v_session
    from public.treatment_plan_sessions s
    where s.plan_id = v_plan.id
      and s.status = 'available'
    order by s.session_number
    limit 1
    for update;

    if not found then
      if exists (
        select 1
        from public.treatment_plan_sessions s
        where s.plan_id = v_plan.id and s.status = 'scheduled'
      ) then
        raise exception 'Este tratamiento ya tiene una sesión futura reservada.';
      end if;
      raise exception 'Este plan no tiene una sesión habilitada para reservar.';
    end if;

    v_duration := v_session.planned_duration_minutes;

    if v_session.session_number > 1 then
      select s.completed_at
      into v_previous_completed_at
      from public.treatment_plan_sessions s
      where s.plan_id = v_plan.id
        and s.session_number = v_session.session_number - 1
        and s.status = 'completed';

      if v_previous_completed_at is null then
        raise exception 'La sesión anterior debe estar finalizada antes de reservar la siguiente.';
      end if;
    end if;
  else
    insert into public.client_treatment_plans (
      client_id,
      treatment_id,
      default_branch_id,
      allow_branch_change,
      total_sessions,
      recommended_interval_days,
      minimum_interval_days,
      maximum_interval_days,
      status,
      started_at,
      created_by
    ) values (
      p_client_id,
      p_treatment_id,
      p_branch_id,
      true,
      v_default_sessions,
      v_recommended,
      v_minimum,
      v_maximum,
      'active',
      null,
      auth.uid()
    ) returning * into v_plan;

    for v_i in 1..v_default_sessions loop
      insert into public.treatment_plan_sessions (
        plan_id,
        session_number,
        planned_duration_minutes,
        status
      ) values (
        v_plan.id,
        v_i,
        v_duration,
        case when v_i = 1 then 'available'::public.treatment_session_status else 'locked'::public.treatment_session_status end
      );
    end loop;

    select s.*
    into v_session
    from public.treatment_plan_sessions s
    where s.plan_id = v_plan.id and s.session_number = 1
    for update;
  end if;

  v_starts_at := (p_date + p_time) at time zone v_timezone;
  v_ends_at := v_starts_at + pg_catalog.make_interval(mins => v_duration);
  v_local_start := v_starts_at at time zone v_timezone;
  v_local_end := v_ends_at at time zone v_timezone;
  v_weekday := extract(dow from v_local_start)::integer;

  if v_local_start::date <> v_local_end::date then
    raise exception 'La cita debe iniciar y terminar el mismo día.';
  end if;

  if v_previous_completed_at is not null then
    if v_plan.minimum_interval_days is not null
       and v_local_start::date < ((v_previous_completed_at at time zone v_timezone)::date + v_plan.minimum_interval_days) then
      raise exception 'La fecha es anterior al intervalo mínimo configurado para la siguiente sesión.';
    end if;

    if v_plan.maximum_interval_days is not null
       and v_local_start::date > ((v_previous_completed_at at time zone v_timezone)::date + v_plan.maximum_interval_days) then
      raise exception 'La fecha supera el intervalo máximo configurado para la siguiente sesión.';
    end if;
  end if;

  if exists (
    select 1
    from public.business_hour_exceptions e
    where e.branch_id = p_branch_id
      and e.exception_date = v_local_start::date
      and e.is_closed
  ) then
    raise exception 'La sucursal está cerrada en la fecha seleccionada.';
  end if;

  select exists (
    select 1
    from public.business_hour_exceptions e
    where e.branch_id = p_branch_id
      and e.exception_date = v_local_start::date
      and not e.is_closed
  ) into v_has_exceptions;

  if v_has_exceptions then
    if not exists (
      select 1
      from public.business_hour_exceptions e
      where e.branch_id = p_branch_id
        and e.exception_date = v_local_start::date
        and not e.is_closed
        and v_local_start::time >= e.start_time
        and v_local_end::time <= e.end_time
    ) then
      raise exception 'La hora seleccionada está fuera del horario especial de la sucursal.';
    end if;
  else
    select exists (
      select 1
      from public.business_hours h
      where h.branch_id = p_branch_id and h.weekday = v_weekday
    ) into v_has_hours;

    if v_has_hours then
      if not exists (
        select 1
        from public.business_hours h
        where h.branch_id = p_branch_id
          and h.weekday = v_weekday
          and v_local_start::time >= h.start_time
          and v_local_end::time <= h.end_time
      ) then
        raise exception 'La hora seleccionada está fuera del horario de la sucursal.';
      end if;
    else
      -- Until the branch hours are configured in Admin, match the calendar fallback.
      if v_local_start::time < time '09:00' or v_local_end::time > time '20:00' then
        raise exception 'La hora seleccionada está fuera del horario provisional de 09:00 a 20:00.';
      end if;
    end if;
  end if;

  if exists (
    select 1
    from public.schedule_blocks b
    where b.branch_id = p_branch_id
      and b.cabin_id is null
      and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
  ) then
    raise exception 'La sucursal está bloqueada en ese horario.';
  end if;

  for v_cabin in
    select c.id, c.name
    from public.treatment_cabins tc
    join public.cabins c
      on c.id = tc.cabin_id
     and c.branch_id = tc.branch_id
    where tc.treatment_id = p_treatment_id
      and tc.branch_id = p_branch_id
      and c.is_active
    order by
      case when p_preferred_cabin_id is not null and c.id = p_preferred_cabin_id then 0 else 1 end,
      c.booking_priority,
      c.sort_order,
      c.name
  loop
    if exists (
      select 1
      from public.schedule_blocks b
      where b.branch_id = p_branch_id
        and b.cabin_id = v_cabin.id
        and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
    ) then
      continue;
    end if;

    if exists (
      select 1
      from public.appointments a
      where a.cabin_id = v_cabin.id
        and a.status in ('pending', 'confirmed', 'arrived')
        and tstzrange(a.starts_at, a.ends_at, '[)') && tstzrange(v_starts_at, v_ends_at, '[)')
    ) then
      continue;
    end if;

    begin
      insert into public.appointments (
        plan_session_id,
        branch_id,
        cabin_id,
        starts_at,
        ends_at,
        status,
        source,
        internal_notes,
        payment_status,
        amount_expected,
        amount_paid,
        created_by
      ) values (
        v_session.id,
        p_branch_id,
        v_cabin.id,
        v_starts_at,
        v_ends_at,
        'confirmed',
        'admin',
        nullif(pg_catalog.btrim(coalesce(p_internal_notes, '')), ''),
        'pending',
        v_price,
        0,
        auth.uid()
      ) returning id into v_appointment_id;

      update public.treatment_plan_sessions s
      set status = 'scheduled', updated_at = now()
      where s.id = v_session.id and s.status = 'available';

      if not found then
        raise exception 'La sesión ya no está disponible. Recarga la agenda e inténtalo nuevamente.';
      end if;

      update public.client_treatment_plans p
      set started_at = coalesce(p.started_at, v_starts_at), updated_at = now()
      where p.id = v_plan.id;

      insert into public.appointment_status_history (
        appointment_id,
        from_status,
        to_status,
        changed_by,
        note
      ) values (
        v_appointment_id,
        null,
        'confirmed',
        auth.uid(),
        'Cita creada manualmente desde agenda administrativa'
      );

      insert into public.audit_logs (
        actor_user_id,
        action,
        entity_type,
        entity_id,
        new_data
      ) values (
        auth.uid(),
        'appointment.created',
        'appointment',
        v_appointment_id,
        pg_catalog.jsonb_build_object(
          'client_id', p_client_id,
          'treatment_id', p_treatment_id,
          'plan_id', v_plan.id,
          'plan_session_id', v_session.id,
          'branch_id', p_branch_id,
          'cabin_id', v_cabin.id,
          'starts_at', v_starts_at,
          'ends_at', v_ends_at,
          'source', 'admin'
        )
      );

      return query
      select
        v_appointment_id,
        v_plan.id,
        v_session.id,
        v_cabin.id,
        v_cabin.name::text,
        v_session.session_number,
        v_plan.total_sessions,
        v_starts_at,
        v_ends_at;
      return;
    exception
      when exclusion_violation then
        -- Another reservation may have taken this cabin at the same instant.
        continue;
      when unique_violation then
        raise exception 'Esta sesión ya tiene una cita activa.';
    end;
  end loop;

  if not exists (
    select 1
    from public.treatment_cabins tc
    join public.cabins c on c.id = tc.cabin_id and c.branch_id = tc.branch_id
    where tc.treatment_id = p_treatment_id
      and tc.branch_id = p_branch_id
      and c.is_active
  ) then
    raise exception 'Este tratamiento todavía no tiene cabinas compatibles configuradas en esta sucursal.';
  end if;

  raise exception 'No hay una cabina compatible disponible en el horario seleccionado.';
end;
$$;

grant execute on function public.admin_create_appointment(uuid, uuid, uuid, date, time, uuid, text) to authenticated;

commit;
