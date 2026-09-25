begin;

alter table public.branches
  add column if not exists google_review_url text;

create or replace function public.admin_update_branch_links(
  p_branch_id uuid,
  p_phone text,
  p_google_review_url text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
  v_review_url text;
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

  v_review_url := nullif(pg_catalog.btrim(coalesce(p_google_review_url, '')), '');
  if v_review_url is not null and v_review_url !~* '^https://(www\.)?(google\.[^/]+|maps\.app\.goo\.gl|goo\.gl|g\.page)/' then
    raise exception 'El enlace de reseña debe ser una URL de Google o Google Maps.';
  end if;

  update public.branches
  set phone = nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''),
      google_review_url = v_review_url,
      updated_at = now()
  where id = p_branch_id;

  if not found then
    raise exception 'Sucursal no encontrada.';
  end if;

  insert into public.audit_logs(actor_user_id, action, entity_type, entity_id, new_data)
  values (
    auth.uid(),
    'branch.links.updated',
    'branch',
    p_branch_id,
    pg_catalog.jsonb_build_object(
      'phone', nullif(pg_catalog.btrim(coalesce(p_phone, '')), ''),
      'google_review_url', v_review_url
    )
  );
end;
$$;

revoke all on function public.admin_update_branch_links(uuid, text, text) from public, anon;
grant execute on function public.admin_update_branch_links(uuid, text, text) to authenticated;

commit;
