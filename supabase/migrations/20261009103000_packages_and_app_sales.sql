-- HAUT Clinical: paquetes en Inicio y venta directa de tratamientos mediante Mercado Pago Checkout Pro.
-- Los tratamientos marcados como paquete dejan de aparecer en el listado normal de Tratamientos.
-- Una compra acreditada crea un plan activo sin cita inicial; recepción agenda posteriormente.

begin;

alter table public.treatments
  add column if not exists is_sold_in_app boolean not null default false,
  add column if not exists is_package boolean not null default false,
  add column if not exists purchase_session_count integer,
  add column if not exists purchase_duration_minutes integer;

comment on column public.treatments.is_sold_in_app is
  'Muestra compra directa en la app. El plan se crea únicamente tras confirmación de pago de Mercado Pago.';
comment on column public.treatments.is_package is
  'Muestra el tratamiento en la sección Paquetes de Inicio y lo excluye del listado normal de Tratamientos.';
comment on column public.treatments.purchase_session_count is
  'Sesiones incluidas específicamente en la compra directa. Independiente de la referencia informativa del catálogo.';
comment on column public.treatments.purchase_duration_minutes is
  'Duración base por sesión para planes creados por compra directa.';

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

do $$ begin
  if not exists (select 1 from pg_constraint where conname='treatments_sale_configuration_complete') then
    alter table public.treatments add constraint treatments_sale_configuration_complete
      check (
        not is_sold_in_app
        or (
          base_price > 0
          and purchase_session_count is not null
          and purchase_duration_minutes is not null
        )
      );
  end if;
end $$;

create table if not exists public.treatment_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  treatment_id uuid not null references public.treatments(id) on delete restrict,
  plan_id uuid references public.client_treatment_plans(id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'mxn',
  provider text not null default 'mercadopago',
  provider_order_id text unique,
  provider_checkout_url text,
  provider_payment_id text,
  provider_status text,
  provider_status_detail text,
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists treatment_purchases_user_idx
  on public.treatment_purchases(user_id, created_at desc);
create index if not exists treatment_purchases_treatment_idx
  on public.treatment_purchases(treatment_id, created_at desc);
create index if not exists treatment_purchases_status_idx
  on public.treatment_purchases(status, created_at desc);
create unique index if not exists treatment_purchases_one_pending_per_treatment_idx
  on public.treatment_purchases(user_id, treatment_id)
  where status='pending';

alter table public.treatment_purchases enable row level security;

drop policy if exists treatment_purchases_owner_read on public.treatment_purchases;
create policy treatment_purchases_owner_read
  on public.treatment_purchases for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists treatment_purchases_staff_read on public.treatment_purchases;
create policy treatment_purchases_staff_read
  on public.treatment_purchases for select
  to authenticated
  using (public.current_app_role() in ('superadmin','branch_admin','reception'));

-- Clientes no insertan ni actualizan compras directamente. Las Edge Functions usan service_role.
revoke insert, update, delete on public.treatment_purchases from anon, authenticated;
grant select on public.treatment_purchases to authenticated;
grant all on public.treatment_purchases to service_role;

drop trigger if exists treatment_purchases_set_updated_at on public.treatment_purchases;
create trigger treatment_purchases_set_updated_at
  before update on public.treatment_purchases
  for each row execute function public.set_updated_at();

create or replace function public.complete_treatment_purchase(
  p_purchase_id uuid,
  p_provider_order_id text,
  p_provider_payment_id text default null,
  p_provider_status text default null,
  p_provider_status_detail text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase public.treatment_purchases%rowtype;
  v_treatment public.treatments%rowtype;
  v_profile public.profiles%rowtype;
  v_branch_id uuid;
  v_plan_id uuid;
begin
  if coalesce(auth.role(),'') <> 'service_role' then
    raise exception 'Solo el servicio de pagos puede completar una compra.' using errcode='42501';
  end if;

  select * into strict v_purchase
  from public.treatment_purchases
  where id = p_purchase_id
  for update;

  if v_purchase.provider <> 'mercadopago' then
    raise exception 'Proveedor de pago no válido para esta compra.';
  end if;

  if v_purchase.provider_order_id is not null and v_purchase.provider_order_id <> p_provider_order_id then
    raise exception 'La order de Mercado Pago no coincide con la compra.';
  end if;

  if v_purchase.status = 'paid' and v_purchase.plan_id is not null then
    return v_purchase.plan_id;
  end if;

  select * into strict v_treatment
  from public.treatments
  where id = v_purchase.treatment_id and is_active and is_sold_in_app;

  if v_treatment.purchase_session_count is null or v_treatment.purchase_duration_minutes is null then
    raise exception 'La configuración de compra de este tratamiento está incompleta.';
  end if;

  select * into strict v_profile from public.profiles where id = v_purchase.user_id;

  -- Idempotencia ante webhooks repetidos.
  perform pg_advisory_xact_lock(hashtextextended(v_purchase.id::text, 0));

  if v_profile.preferred_branch_id is not null and exists (
    select 1 from public.treatment_branches tb
    where tb.treatment_id=v_treatment.id
      and tb.branch_id=v_profile.preferred_branch_id
      and tb.is_active
  ) then
    v_branch_id := v_profile.preferred_branch_id;
  else
    select tb.branch_id into v_branch_id
    from public.treatment_branches tb
    join public.branches b on b.id=tb.branch_id and b.is_active
    where tb.treatment_id=v_treatment.id and tb.is_active
    order by b.name
    limit 1;
  end if;

  insert into public.client_treatment_plans (
    client_id, treatment_id, default_branch_id, total_sessions,
    recommended_interval_days, minimum_interval_days, maximum_interval_days,
    status, started_at, created_by, internal_notes
  ) values (
    v_purchase.user_id, v_treatment.id, v_branch_id, v_treatment.purchase_session_count,
    v_treatment.recommended_interval_days, v_treatment.minimum_interval_days, v_treatment.maximum_interval_days,
    'active', now(), v_purchase.user_id,
    'Plan adquirido directamente desde la app mediante Mercado Pago. Primera cita pendiente de programación por HAUT.'
  ) returning id into v_plan_id;

  insert into public.treatment_plan_sessions(plan_id, session_number, planned_duration_minutes, status)
    select v_plan_id, i, v_treatment.purchase_duration_minutes,
      case when i=1 then 'available'::public.treatment_session_status else 'locked'::public.treatment_session_status end
    from generate_series(1, v_treatment.purchase_session_count) as i;

  update public.treatment_purchases
  set status='paid',
      plan_id=v_plan_id,
      provider_order_id=coalesce(provider_order_id,p_provider_order_id),
      provider_payment_id=coalesce(p_provider_payment_id,provider_payment_id),
      provider_status=coalesce(p_provider_status,provider_status),
      provider_status_detail=coalesce(p_provider_status_detail,provider_status_detail),
      paid_at=coalesce(paid_at,now()),
      updated_at=now()
  where id=v_purchase.id;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, new_data)
  values (
    v_purchase.user_id,
    'purchase_treatment',
    'client_treatment_plan',
    v_plan_id,
    jsonb_build_object(
      'purchase_id',v_purchase.id,
      'treatment_id',v_treatment.id,
      'amount',v_purchase.amount,
      'currency',v_purchase.currency,
      'provider','mercadopago',
      'provider_order_id',p_provider_order_id,
      'provider_payment_id',p_provider_payment_id,
      'source','app_purchase'
    )
  );

  return v_plan_id;
end;
$$;

revoke all on function public.complete_treatment_purchase(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.complete_treatment_purchase(uuid,text,text,text,text) to service_role;

commit;
