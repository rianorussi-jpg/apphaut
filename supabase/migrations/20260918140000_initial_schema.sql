begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create type public.app_role as enum ('superadmin', 'branch_admin', 'reception');
create type public.appointment_status as enum ('pending', 'confirmed', 'arrived', 'completed', 'cancelled', 'no_show');
create type public.appointment_source as enum ('mobile_app', 'admin', 'phone', 'walk_in');
create type public.payment_status as enum ('pending', 'partial', 'paid', 'refunded', 'waived');
create type public.treatment_plan_status as enum ('active', 'paused', 'completed', 'cancelled');
create type public.treatment_session_status as enum ('locked', 'available', 'scheduled', 'completed', 'voided');
create type public.notification_channel as enum ('push', 'email', 'whatsapp');
create type public.notification_status as enum ('queued', 'processing', 'sent', 'failed', 'cancelled');

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  birth_date date,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.branches (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  address text,
  phone text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  timezone text not null default 'America/Mexico_City',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.cabins (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  name text not null,
  description text,
  booking_priority integer not null default 100,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cabins_branch_name_unique unique (branch_id, name),
  constraint cabins_id_branch_unique unique (id, branch_id)
);

create table public.treatment_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.treatments (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.treatment_categories(id) on delete restrict,
  name text not null,
  slug text not null unique,
  short_description text,
  description text,
  image_url text,
  base_price numeric(12,2) not null default 0 check (base_price >= 0),
  default_duration_minutes integer not null check (default_duration_minutes > 0),
  default_session_count integer not null default 1 check (default_session_count > 0),
  recommended_interval_days integer check (recommended_interval_days is null or recommended_interval_days >= 0),
  minimum_interval_days integer check (minimum_interval_days is null or minimum_interval_days >= 0),
  maximum_interval_days integer check (maximum_interval_days is null or maximum_interval_days >= 0),
  recommendations text,
  contraindications text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint treatment_interval_bounds check (
    minimum_interval_days is null
    or maximum_interval_days is null
    or minimum_interval_days <= maximum_interval_days
  )
);

create table public.treatment_branches (
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  is_active boolean not null default true,
  price_override numeric(12,2) check (price_override is null or price_override >= 0),
  duration_override_minutes integer check (duration_override_minutes is null or duration_override_minutes > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (treatment_id, branch_id)
);

create table public.treatment_cabins (
  treatment_id uuid not null,
  branch_id uuid not null,
  cabin_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (treatment_id, branch_id, cabin_id),
  foreign key (treatment_id, branch_id)
    references public.treatment_branches(treatment_id, branch_id)
    on delete cascade,
  foreign key (cabin_id, branch_id)
    references public.cabins(id, branch_id)
    on delete restrict
);

create table public.business_hours (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (start_time < end_time),
  unique (branch_id, weekday, start_time, end_time)
);

create table public.business_hour_exceptions (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  exception_date date not null,
  start_time time,
  end_time time,
  is_closed boolean not null default false,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_hour_exception_valid check (
    (is_closed and start_time is null and end_time is null)
    or
    (not is_closed and start_time is not null and end_time is not null and start_time < end_time)
  ),
  unique (branch_id, exception_date, start_time, end_time)
);

create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete restrict,
  cabin_id uuid,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  foreign key (cabin_id, branch_id)
    references public.cabins(id, branch_id)
    on delete restrict
);

create table public.client_treatment_plans (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  default_branch_id uuid references public.branches(id) on delete restrict,
  allow_branch_change boolean not null default false,
  total_sessions integer not null check (total_sessions > 0),
  recommended_interval_days integer check (recommended_interval_days is null or recommended_interval_days >= 0),
  minimum_interval_days integer check (minimum_interval_days is null or minimum_interval_days >= 0),
  maximum_interval_days integer check (maximum_interval_days is null or maximum_interval_days >= 0),
  status public.treatment_plan_status not null default 'active',
  started_at timestamptz,
  completed_at timestamptz,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint client_plan_interval_bounds check (
    minimum_interval_days is null
    or maximum_interval_days is null
    or minimum_interval_days <= maximum_interval_days
  )
);

create table public.treatment_plan_sessions (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.client_treatment_plans(id) on delete restrict,
  session_number integer not null check (session_number > 0),
  planned_duration_minutes integer not null check (planned_duration_minutes > 0),
  status public.treatment_session_status not null default 'locked',
  completed_at timestamptz,
  internal_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, session_number)
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  plan_session_id uuid not null references public.treatment_plan_sessions(id) on delete restrict,
  branch_id uuid not null references public.branches(id) on delete restrict,
  cabin_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'pending',
  source public.appointment_source not null default 'mobile_app',
  client_notes text,
  internal_notes text,
  payment_status public.payment_status not null default 'pending',
  amount_expected numeric(12,2) not null default 0 check (amount_expected >= 0),
  amount_paid numeric(12,2) not null default 0 check (amount_paid >= 0),
  created_by uuid references auth.users(id) on delete set null,
  checked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_at < ends_at),
  foreign key (cabin_id, branch_id)
    references public.cabins(id, branch_id)
    on delete restrict
);

alter table public.appointments
  add constraint appointments_no_active_cabin_overlap
  exclude using gist (
    cabin_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  )
  where (status in ('pending', 'confirmed', 'arrived'));

create unique index appointments_one_active_per_plan_session
  on public.appointments(plan_session_id)
  where status in ('pending', 'confirmed', 'arrived');

create table public.appointment_status_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_branch_access (
  user_id uuid not null references auth.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, branch_id)
);

create table public.client_notes (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete restrict,
  note text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated by default as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  push_token text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete cascade,
  channel public.notification_channel not null,
  template_key text not null,
  payload jsonb not null default '{}'::jsonb,
  scheduled_at timestamptz not null,
  status public.notification_status not null default 'queued',
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cabins_branch_idx on public.cabins(branch_id) where is_active;
create index treatment_branches_branch_idx on public.treatment_branches(branch_id) where is_active;
create index treatment_cabins_treatment_branch_idx on public.treatment_cabins(treatment_id, branch_id);
create index business_hours_branch_weekday_idx on public.business_hours(branch_id, weekday);
create index schedule_blocks_branch_time_idx on public.schedule_blocks(branch_id, starts_at, ends_at);
create index client_treatment_plans_client_idx on public.client_treatment_plans(client_id, status);
create index treatment_plan_sessions_plan_idx on public.treatment_plan_sessions(plan_id, session_number);
create index appointments_branch_starts_idx on public.appointments(branch_id, starts_at);
create index appointments_cabin_starts_idx on public.appointments(cabin_id, starts_at);
create index appointments_status_idx on public.appointments(status);
create index appointment_status_history_appointment_idx on public.appointment_status_history(appointment_id, created_at desc);
create index user_branch_access_branch_idx on public.user_branch_access(branch_id, user_id);
create index client_notes_client_idx on public.client_notes(client_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index notification_jobs_due_idx on public.notification_jobs(status, scheduled_at);

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger branches_set_updated_at before update on public.branches for each row execute function public.set_updated_at();
create trigger cabins_set_updated_at before update on public.cabins for each row execute function public.set_updated_at();
create trigger treatment_categories_set_updated_at before update on public.treatment_categories for each row execute function public.set_updated_at();
create trigger treatments_set_updated_at before update on public.treatments for each row execute function public.set_updated_at();
create trigger treatment_branches_set_updated_at before update on public.treatment_branches for each row execute function public.set_updated_at();
create trigger business_hours_set_updated_at before update on public.business_hours for each row execute function public.set_updated_at();
create trigger business_hour_exceptions_set_updated_at before update on public.business_hour_exceptions for each row execute function public.set_updated_at();
create trigger schedule_blocks_set_updated_at before update on public.schedule_blocks for each row execute function public.set_updated_at();
create trigger client_treatment_plans_set_updated_at before update on public.client_treatment_plans for each row execute function public.set_updated_at();
create trigger treatment_plan_sessions_set_updated_at before update on public.treatment_plan_sessions for each row execute function public.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function public.set_updated_at();
create trigger user_roles_set_updated_at before update on public.user_roles for each row execute function public.set_updated_at();
create trigger client_notes_set_updated_at before update on public.client_notes for each row execute function public.set_updated_at();
create trigger notification_devices_set_updated_at before update on public.notification_devices for each row execute function public.set_updated_at();
create trigger notification_jobs_set_updated_at before update on public.notification_jobs for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select ur.role
  from public.user_roles ur
  where ur.user_id = auth.uid()
  limit 1;
$$;

create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = auth.uid()
      and ur.role in ('superadmin', 'branch_admin', 'reception')
  );
$$;

create function public.can_access_branch(target_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = auth.uid()
        and ur.role = 'superadmin'
    )
    or exists (
      select 1
      from public.user_roles ur
      join public.user_branch_access uba on uba.user_id = ur.user_id
      where ur.user_id = auth.uid()
        and ur.role in ('branch_admin', 'reception')
        and uba.branch_id = target_branch_id
    );
$$;

alter table public.profiles enable row level security;
alter table public.branches enable row level security;
alter table public.cabins enable row level security;
alter table public.treatment_categories enable row level security;
alter table public.treatments enable row level security;
alter table public.treatment_branches enable row level security;
alter table public.treatment_cabins enable row level security;
alter table public.business_hours enable row level security;
alter table public.business_hour_exceptions enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.client_treatment_plans enable row level security;
alter table public.treatment_plan_sessions enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_status_history enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_branch_access enable row level security;
alter table public.client_notes enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_devices enable row level security;
alter table public.notification_jobs enable row level security;

create policy profiles_select_self
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_staff_select
  on public.profiles for select
  to authenticated
  using (public.is_staff());

create policy branches_public_read
  on public.branches for select
  to anon, authenticated
  using (is_active = true or public.is_staff());

create policy treatment_categories_public_read
  on public.treatment_categories for select
  to anon, authenticated
  using (is_active = true or public.is_staff());

create policy treatments_public_read
  on public.treatments for select
  to anon, authenticated
  using (is_active = true or public.is_staff());

create policy treatment_branches_public_read
  on public.treatment_branches for select
  to anon, authenticated
  using (
    (is_active = true and exists (
      select 1 from public.treatments t where t.id = treatment_id and t.is_active
    ) and exists (
      select 1 from public.branches b where b.id = branch_id and b.is_active
    ))
    or public.is_staff()
  );

create policy cabins_staff_read
  on public.cabins for select
  to authenticated
  using (public.can_access_branch(branch_id));

create policy treatment_cabins_staff_read
  on public.treatment_cabins for select
  to authenticated
  using (public.can_access_branch(branch_id));

create policy business_hours_staff_read
  on public.business_hours for select
  to authenticated
  using (public.can_access_branch(branch_id));

create policy business_hour_exceptions_staff_read
  on public.business_hour_exceptions for select
  to authenticated
  using (public.can_access_branch(branch_id));

create policy schedule_blocks_staff_read
  on public.schedule_blocks for select
  to authenticated
  using (public.can_access_branch(branch_id));

create policy client_treatment_plans_owner_read
  on public.client_treatment_plans for select
  to authenticated
  using (client_id = auth.uid());

create policy client_treatment_plans_staff_read
  on public.client_treatment_plans for select
  to authenticated
  using (
    public.current_app_role() = 'superadmin'
    or (default_branch_id is not null and public.can_access_branch(default_branch_id))
  );

create policy treatment_plan_sessions_owner_read
  on public.treatment_plan_sessions for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_treatment_plans p
      where p.id = plan_id and p.client_id = auth.uid()
    )
  );

create policy treatment_plan_sessions_staff_read
  on public.treatment_plan_sessions for select
  to authenticated
  using (
    exists (
      select 1
      from public.client_treatment_plans p
      where p.id = plan_id
        and (
          public.current_app_role() = 'superadmin'
          or (p.default_branch_id is not null and public.can_access_branch(p.default_branch_id))
        )
    )
  );

create policy appointments_owner_read
  on public.appointments for select
  to authenticated
  using (
    exists (
      select 1
      from public.treatment_plan_sessions s
      join public.client_treatment_plans p on p.id = s.plan_id
      where s.id = plan_session_id and p.client_id = auth.uid()
    )
  );

create policy appointments_staff_read
  on public.appointments for select
  to authenticated
  using (public.can_access_branch(branch_id));

create policy appointment_status_history_owner_read
  on public.appointment_status_history for select
  to authenticated
  using (
    exists (
      select 1
      from public.appointments a
      join public.treatment_plan_sessions s on s.id = a.plan_session_id
      join public.client_treatment_plans p on p.id = s.plan_id
      where a.id = appointment_id and p.client_id = auth.uid()
    )
  );

create policy appointment_status_history_staff_read
  on public.appointment_status_history for select
  to authenticated
  using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and public.can_access_branch(a.branch_id)
    )
  );

create policy user_roles_self_read
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

create policy user_branch_access_self_read
  on public.user_branch_access for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_devices_owner_read
  on public.notification_devices for select
  to authenticated
  using (user_id = auth.uid());

create policy notification_jobs_owner_read
  on public.notification_jobs for select
  to authenticated
  using (user_id = auth.uid());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'treatment-images',
  'treatment-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy treatment_images_public_read
  on storage.objects for select
  to public
  using (bucket_id = 'treatment-images');

create policy treatment_images_staff_insert
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'treatment-images' and public.is_staff());

create policy treatment_images_staff_update
  on storage.objects for update
  to authenticated
  using (bucket_id = 'treatment-images' and public.is_staff())
  with check (bucket_id = 'treatment-images' and public.is_staff());

create policy treatment_images_staff_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'treatment-images' and public.is_staff());

commit;
