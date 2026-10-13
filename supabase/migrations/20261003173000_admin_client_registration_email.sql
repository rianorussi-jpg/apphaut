-- HAUT Clinical: alta de clientes desde Admin + correo de bienvenida.
-- La creación segura del usuario Auth se realiza en la Edge Function admin-create-client.
begin;

create unique index if not exists notification_jobs_email_client_registered_unique
  on public.notification_jobs(user_id, template_key)
  where channel = 'email' and template_key = 'client_registered';

commit;
