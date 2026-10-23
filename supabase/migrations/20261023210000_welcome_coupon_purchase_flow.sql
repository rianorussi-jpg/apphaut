-- HAUT Clinical: cupón de bienvenida del 10% y cancelación de solicitudes de compra.
-- El cupón no requiere una fila separada por cliente: está disponible mientras el cliente
-- no tenga una compra asignada y no exista una solicitud activa que lo esté reservando.

begin;

alter table public.treatment_purchase_requests
  add column if not exists uses_welcome_coupon boolean not null default false,
  add column if not exists coupon_discount_percent integer not null default 0;

alter table public.treatment_purchase_requests
  drop constraint if exists treatment_purchase_requests_coupon_discount_allowed;
alter table public.treatment_purchase_requests
  add constraint treatment_purchase_requests_coupon_discount_allowed
  check (coupon_discount_percent in (0,10));

comment on column public.treatment_purchase_requests.uses_welcome_coupon is
  'Indica que esta solicitud reservó el cupón de bienvenida del cliente. Se libera si la solicitud se cancela.';
comment on column public.treatment_purchase_requests.coupon_discount_percent is
  'Porcentaje de descuento reservado para esta solicitud. Actualmente 10% para el cupón de bienvenida.';

create index if not exists treatment_purchase_requests_coupon_user_idx
  on public.treatment_purchase_requests(user_id, uses_welcome_coupon, status, created_at desc);

-- Si ya había solicitudes abiertas antes de activar el cupón, reserva el cupón en la primera
-- solicitud abierta del cliente siempre que todavía no tenga ninguna compra asignada.
with candidates as (
  select r.id,
         row_number() over (partition by r.user_id order by r.created_at asc, r.id asc) as rn
  from public.treatment_purchase_requests r
  where r.status in ('pending','contacted')
    and not exists (
      select 1
      from public.treatment_purchase_requests assigned
      where assigned.user_id=r.user_id
        and assigned.status='assigned'
    )
)
update public.treatment_purchase_requests r
set uses_welcome_coupon=true,
    coupon_discount_percent=10
from candidates c
where c.id=r.id
  and c.rn=1
  and not exists (
    select 1
    from public.treatment_purchase_requests existing_coupon
    where existing_coupon.user_id=r.user_id
      and existing_coupon.uses_welcome_coupon
      and existing_coupon.status in ('pending','contacted','assigned')
      and existing_coupon.id<>r.id
  );

-- Cliente: crea (o reutiliza) su solicitud. La primera compra elegible reserva el cupón.
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
  v_use_coupon boolean := false;
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

  -- Un candado por cliente evita que dos clics simultáneos reserven el mismo cupón.
  perform pg_advisory_xact_lock(hashtextextended('haut-purchase:' || auth.uid()::text, 0));

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

  v_use_coupon :=
    not exists (
      select 1
      from public.treatment_purchase_requests r
      where r.user_id=auth.uid()
        and r.status='assigned'
    )
    and not exists (
      select 1
      from public.treatment_purchase_requests r
      where r.user_id=auth.uid()
        and r.uses_welcome_coupon
        and r.status in ('pending','contacted','assigned')
    );

  insert into public.treatment_purchase_requests (
    user_id,treatment_id,branch_id,status,session_count,duration_minutes,quoted_amount,
    uses_welcome_coupon,coupon_discount_percent
  ) values (
    auth.uid(),v_t.id,v_profile.preferred_branch_id,'pending',
    v_t.purchase_session_count,v_t.purchase_duration_minutes,v_t.base_price,
    v_use_coupon,case when v_use_coupon then 10 else 0 end
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
      'uses_welcome_coupon',v_use_coupon,
      'coupon_discount_percent',case when v_use_coupon then 10 else 0 end,
      'source','client_app'
    )
  );

  return v_request_id;
end;
$$;

revoke all on function public.request_treatment_purchase(uuid) from public, anon;
grant execute on function public.request_treatment_purchase(uuid) to authenticated;

-- Admin/recepción: cancela una solicitud que no llegó a concretarse.
-- Si esa solicitud tenía reservado el cupón, el cliente vuelve a tenerlo disponible
-- automáticamente porque las solicitudes canceladas no bloquean el cupón.
create or replace function public.admin_cancel_purchase_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.treatment_purchase_requests%rowtype;
begin
  if auth.uid() is null or not public.is_staff() then
    raise exception 'No tienes permiso para cancelar compras.' using errcode='42501';
  end if;

  select * into strict v_request
  from public.treatment_purchase_requests
  where id=p_request_id
  for update;

  if not public.can_access_branch(v_request.branch_id) then
    raise exception 'No tienes acceso a la sucursal de esta solicitud.' using errcode='42501';
  end if;

  if v_request.status='cancelled' then
    return;
  end if;

  if v_request.status='assigned' then
    raise exception 'No se puede cancelar una compra que ya fue asignada.';
  end if;

  update public.treatment_purchase_requests
  set status='cancelled'
  where id=p_request_id;

  insert into public.audit_logs(actor_user_id,action,entity_type,entity_id,new_data)
  values (
    auth.uid(),'cancel_purchase_request','treatment_purchase_request',p_request_id,
    jsonb_build_object(
      'previous_status',v_request.status,
      'released_welcome_coupon',v_request.uses_welcome_coupon,
      'coupon_discount_percent',v_request.coupon_discount_percent
    )
  );
end;
$$;

revoke all on function public.admin_cancel_purchase_request(uuid) from public, anon;
grant execute on function public.admin_cancel_purchase_request(uuid) to authenticated;

commit;
