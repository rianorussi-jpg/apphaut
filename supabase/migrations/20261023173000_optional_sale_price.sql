-- HAUT Clinical: precio opcional para tratamientos vendidos mediante solicitud por WhatsApp.
-- Las sesiones y duración del plan siguen siendo obligatorias para poder asignarlo después.

begin;

alter table public.treatments
  drop constraint if exists treatments_purchase_request_configuration_complete;

alter table public.treatments
  add constraint treatments_purchase_request_configuration_complete
  check (
    not is_sold_in_app
    or (
      purchase_session_count is not null
      and purchase_duration_minutes is not null
    )
  );

comment on column public.treatments.base_price is
  'Precio informativo opcional. Un valor 0 significa que no se publica precio y HAUT lo concreta por WhatsApp.';

commit;
