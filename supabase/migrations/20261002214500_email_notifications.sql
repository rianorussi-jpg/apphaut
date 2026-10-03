-- HAUT Clinical: correos transaccionales para tratamientos, citas y recordatorios.
-- Ejecutar una sola vez después de las migraciones anteriores.
begin;

-- Reutilizamos notification_jobs creada desde la migración inicial.
alter table public.notification_jobs
  add column if not exists plan_id uuid references public.client_treatment_plans(id) on delete cascade;

create index if not exists notification_jobs_plan_idx
  on public.notification_jobs(plan_id, created_at desc)
  where plan_id is not null;

-- Evita duplicar correos del mismo evento.
create unique index if not exists notification_jobs_email_plan_unique
  on public.notification_jobs(template_key, plan_id)
  where channel = 'email' and plan_id is not null and template_key = 'treatment_assigned';

create unique index if not exists notification_jobs_email_appointment_unique
  on public.notification_jobs(template_key, appointment_id)
  where channel = 'email' and appointment_id is not null
    and template_key in ('appointment_created', 'appointment_reminder_24h');

-- Al asignar un plan nuevo, encola correo inmediato.
create or replace function public.enqueue_treatment_assigned_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_jobs (
    user_id,
    plan_id,
    channel,
    template_key,
    payload,
    scheduled_at,
    status
  ) values (
    new.client_id,
    new.id,
    'email',
    'treatment_assigned',
    pg_catalog.jsonb_build_object('plan_id', new.id),
    now(),
    'queued'
  )
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function public.enqueue_treatment_assigned_email() from public, anon, authenticated;

drop trigger if exists haut_enqueue_treatment_assigned_email on public.client_treatment_plans;
create trigger haut_enqueue_treatment_assigned_email
  after insert on public.client_treatment_plans
  for each row execute function public.enqueue_treatment_assigned_email();

-- Al crear una cita, encola confirmación inmediata y, si hay tiempo suficiente,
-- recordatorio para 24 horas antes.
create or replace function public.enqueue_appointment_emails()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_plan_id uuid;
begin
  select p.client_id, p.id
    into v_client_id, v_plan_id
  from public.treatment_plan_sessions s
  join public.client_treatment_plans p on p.id = s.plan_id
  where s.id = new.plan_session_id;

  if v_client_id is null then
    return new;
  end if;

  insert into public.notification_jobs (
    user_id,
    appointment_id,
    plan_id,
    channel,
    template_key,
    payload,
    scheduled_at,
    status
  ) values (
    v_client_id,
    new.id,
    v_plan_id,
    'email',
    'appointment_created',
    pg_catalog.jsonb_build_object('appointment_id', new.id),
    now(),
    'queued'
  )
  on conflict do nothing;

  -- Si la cita se agenda con menos de 24 horas de anticipación no mandamos
  -- un segundo correo de "recordatorio 24 h" inmediatamente.
  if new.starts_at >= now() + interval '24 hours'
     and new.status in ('pending', 'confirmed', 'arrived') then
    insert into public.notification_jobs (
      user_id,
      appointment_id,
      plan_id,
      channel,
      template_key,
      payload,
      scheduled_at,
      status
    ) values (
      v_client_id,
      new.id,
      v_plan_id,
      'email',
      'appointment_reminder_24h',
      pg_catalog.jsonb_build_object('appointment_id', new.id),
      new.starts_at - interval '24 hours',
      'queued'
    )
    on conflict do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.enqueue_appointment_emails() from public, anon, authenticated;

drop trigger if exists haut_enqueue_appointment_emails on public.appointments;
create trigger haut_enqueue_appointment_emails
  after insert on public.appointments
  for each row execute function public.enqueue_appointment_emails();

-- Si una cita cambia, mantener el recordatorio coherente.
create or replace function public.sync_appointment_reminder_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Una cita que ya no ocurrirá no debe generar recordatorio.
  if new.status in ('cancelled', 'completed', 'no_show') then
    update public.notification_jobs
       set status = 'cancelled',
           updated_at = now(),
           last_error = null
     where appointment_id = new.id
       and channel = 'email'
       and template_key = 'appointment_reminder_24h'
       and status in ('queued', 'processing');
    return new;
  end if;

  -- Si se reagenda antes de enviarse el recordatorio, mover su fecha.
  if new.starts_at is distinct from old.starts_at then
    if new.starts_at >= now() + interval '24 hours' then
      update public.notification_jobs
         set scheduled_at = new.starts_at - interval '24 hours',
             status = 'queued',
             last_error = null,
             updated_at = now()
       where appointment_id = new.id
         and channel = 'email'
         and template_key = 'appointment_reminder_24h'
         and status in ('queued', 'processing');

      -- Puede no existir si originalmente se creó con menos de 24 h.
      if not found and not exists (
        select 1
          from public.notification_jobs
         where appointment_id = new.id
           and channel = 'email'
           and template_key = 'appointment_reminder_24h'
           and status = 'sent'
      ) then
        insert into public.notification_jobs (
          user_id,
          appointment_id,
          plan_id,
          channel,
          template_key,
          payload,
          scheduled_at,
          status
        )
        select
          p.client_id,
          new.id,
          p.id,
          'email',
          'appointment_reminder_24h',
          pg_catalog.jsonb_build_object('appointment_id', new.id),
          new.starts_at - interval '24 hours',
          'queued'
        from public.treatment_plan_sessions s
        join public.client_treatment_plans p on p.id = s.plan_id
        where s.id = new.plan_session_id
        on conflict do nothing;
      end if;
    else
      update public.notification_jobs
         set status = 'cancelled',
             updated_at = now()
       where appointment_id = new.id
         and channel = 'email'
         and template_key = 'appointment_reminder_24h'
         and status in ('queued', 'processing');
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_appointment_reminder_email() from public, anon, authenticated;

drop trigger if exists haut_sync_appointment_reminder_email on public.appointments;
create trigger haut_sync_appointment_reminder_email
  after update of starts_at, status on public.appointments
  for each row execute function public.sync_appointment_reminder_email();

-- El worker reclama lotes con SKIP LOCKED para que dos ejecuciones simultáneas
-- no procesen el mismo correo. Los jobs atascados se reintentan.
create or replace function public.claim_due_email_jobs(p_limit integer default 25)
returns setof public.notification_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 25), 100));
begin
  update public.notification_jobs
     set status = case when attempts >= 5 then 'failed'::public.notification_status
                       else 'queued'::public.notification_status end,
         last_error = coalesce(last_error, 'Procesamiento interrumpido; se reintentó automáticamente.'),
         updated_at = now()
   where channel = 'email'
     and status = 'processing'
     and updated_at < now() - interval '15 minutes';

  return query
  with due as (
    select j.id
      from public.notification_jobs j
     where j.channel = 'email'
       and j.status = 'queued'
       and j.scheduled_at <= now()
     order by j.scheduled_at, j.created_at
     for update skip locked
     limit v_limit
  )
  update public.notification_jobs j
     set status = 'processing',
         attempts = j.attempts + 1,
         updated_at = now()
    from due
   where j.id = due.id
  returning j.*;
end;
$$;

revoke all on function public.claim_due_email_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_due_email_jobs(integer) to service_role;

commit;
