# HAUT Clinical · Mercado Pago Checkout Pro

La venta directa usa **Mercado Pago Checkout Pro mediante Orders API**. El tratamiento solo se agrega a `Mis tratamientos` cuando Mercado Pago confirma que la order está `processed` con `status_detail = accredited`.

## 1. SQL
Ejecuta `supabase/migrations/20261009103000_packages_and_app_sales.sql` en el proyecto HAUT.

## 2. Secrets de Supabase Edge Functions
Agrega:

- `MERCADOPAGO_ACCESS_TOKEN` = Access Token productivo de la aplicación de Mercado Pago.
- `MERCADOPAGO_WEBHOOK_SECRET` = clave secreta generada al configurar el Webhook.
- `CLIENT_APP_URL` = URL pública actual de la app cliente, sin slash final.

No hace falta Public Key para este flujo porque Checkout Pro abre el checkout hospedado por Mercado Pago.

## 3. Edge Functions
Despliega:

- `create-treatment-checkout` con **Verify JWT = ON**.
- `mercadopago-treatment-webhook` con **Verify JWT = OFF**.

## 4. Webhook en Mercado Pago
En **Tus integraciones → tu aplicación → Webhooks**, configura en modo productivo:

`https://TU_PROJECT_REF.supabase.co/functions/v1/mercadopago-treatment-webhook`

Selecciona el evento **Order (Mercado Pago)** y guarda. Copia la clave secreta generada y guárdala como `MERCADOPAGO_WEBHOOK_SECRET`.

## 5. Flujo

1. El cliente toca `Comprar`.
2. `create-treatment-checkout` crea una order en Mercado Pago con una `X-Idempotency-Key` única.
3. La app redirige al `checkout_url` de Mercado Pago.
4. Mercado Pago envía el Webhook de la order.
5. HAUT valida la firma `x-signature` y vuelve a consultar la order directamente en la API de Mercado Pago.
6. Solo si la order está acreditada se crea el plan y sus sesiones.
7. No se crea una cita. Recepción programa posteriormente la primera sesión.
