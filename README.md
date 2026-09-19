# Haut Clinical — Admin + app web de clientes

Este proyecto contiene dos aplicaciones web **Next.js independientes**, preparadas para desplegarse en **dos proyectos de Vercel** desde un único repositorio de GitHub. No utiliza Expo ni Capacitor.

## 1. Actualizar Supabase existente (solo una vez)

Si ya ejecutaste anteriormente el esquema inicial (`20260918140000_initial_schema.sql`), el `seed.sql` y la migración de reservas (`20260918173000_admin_booking.sql`), **no los repitas**.

En **Supabase → SQL Editor**, ejecuta únicamente el contenido de:

`supabase/migrations/20260919001000_client_app.sql`

Esa migración añade: sucursal preferida del usuario, trigger de registro, promociones, ledger de rewards, funciones seguras para asignación de tratamientos y finalización/cancelación de citas, permisos RLS y la escritura del catálogo para superadmin. Ejecuta el SQL **antes** de abrir la nueva versión de la app.

> Si tu Supabase es nuevo y no has ejecutado ninguna migración: aplica, en orden, la migración `20260918140000_initial_schema.sql`, la migración `20260918173000_admin_booking.sql` y finalmente `20260919001000_client_app.sql`. El `seed.sql` (categorías) se puede ejecutar después de la inicial, antes de crear tratamientos. **No ejecutes migraciones ya aplicadas**.

## 2. Vercel: panel administrativo

Crea o actualiza el proyecto conectado a este repositorio.

- Root Directory: `apps/admin`
- Framework Preset: **Next.js**
- Build / Install / Output Directory: valores predeterminados; Output Directory **no es `public`**.
- `NEXT_PUBLIC_SUPABASE_URL` = URL del proyecto de Supabase
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = su *publishable key*

Conserva tu usuario `superadmin` creado en Supabase Auth con el rol en `public.user_roles`. No uses `service_role` ni claves secretas en variables `NEXT_PUBLIC_`.

## 3. Vercel: app del cliente

Crea un **segundo proyecto de Vercel**, apuntando al mismo repo:

- Root Directory: `apps/mobile`
- Framework Preset: **Next.js**
- Build / Install / Output Directory: predeterminados.
- `NEXT_PUBLIC_SUPABASE_URL` = **la misma** URL del proyecto.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = **la misma** publishable key.
- `NEXT_PUBLIC_HAUT_WHATSAPP_NUMBER` = número **real** de WhatsApp para consultas, con código de país y solo dígitos, por ejemplo `52` + 10 dígitos de México (no escribas literalmente el ejemplo). Si no se define, el frontend intenta utilizar `branches.phone` de la sucursal del cliente. Si tampoco existe, muestra aviso en vez de inventar un enlace.

Al añadir o cambiar las variables, despliega de nuevo el proyecto. Para usar el registro con confirmación por correo, agrega la URL real del proyecto **mobile** en **Supabase → Authentication → URL Configuration → Redirect URLs**. Configura `Site URL` para el dominio apropiado de tu app de clientes. En **Authentication → Providers → Email** revisa si está habilitada la confirmación de email. Si está habilitada, el usuario deberá abrir el correo de confirmación antes de iniciar sesión. Para correos de producción configura un proveedor SMTP adecuado y revisa límites de envío.

### Flujo del cliente

La primera visita muestra Iniciar sesión / Registrarse. Registro solicita nombre, teléfono, correo, contraseña, confirmación y sucursal preferida. Supabase Auth guarda la sesión en el navegador; al volver a abrir la app desde el mismo dispositivo y navegador, no se pide iniciar sesión de nuevo mientras la sesión siga válida, no se borren datos locales ni se cierre sesión. Si se usa navegación privada u otro dispositivo hay que iniciar sesión allí.

Después de ingresar, el cliente ve sus datos **reales** en Supabase: próximas citas e historial, planes/sesiones asignados, promociones publicadas, puntos Rewards y catálogo de tratamientos. No existen citas ficticias y **no hay botón ni ruta de reserva para el cliente**. En el detalle del catálogo se puede solicitar información por WhatsApp.

### Trabajo administrativo para poblar la app

1. En Admin → **Tratamientos**, crea un tratamiento y asigna sus sucursales y cabinas compatibles. (Superadmin.)
2. Pide al cliente que se registre en `mobile`. Después aparece en Admin → **Clientes**.
3. En Admin → **Clientes**, selecciónalo y pulsa **Asignar plan**. Puedes elegir un número de sesiones distinto al predeterminado. Queda visible en Mis tratamientos del cliente, incluso sin cita.
4. En Admin → **Agenda**, crea la cita para ese cliente y tratamiento. El motor de reservas reutiliza el plan activo y asigna su sesión disponible. Deben existir cabinas y horarios configurados para que una reserva sea posible.
5. En Admin → **Citas → Detalle**, marca Finalizar sesión para actualizar el progreso y habilitar la siguiente. Cancelar o marcar no asistió no suma sesiones.
6. En Admin → **Promociones**, publica contenido que aparecerá en la app.
7. En Admin → **Clientes → Rewards**, registra puntos con motivo. La app presenta el saldo calculado desde movimientos reales.

**Rewards:** esta entrega incluye un ledger interno de puntos en Supabase para Haut. **No está conectada automáticamente a una cuenta, tarjeta Wallet ni al servicio externo `rewards.enla.mx`**. Si los rewards de Haut ya existen en otra plataforma, hay que definir su API/esquema e integrar una fuente de verdad antes de mostrar esos saldos existentes; de momento el saldo empieza en cero y se puede alimentar desde el panel.

**Alcance actual:** los cambios a citas se gestionan en el admin; el cliente solo consulta. No están implementados el reagendamiento visual, cobros en línea, correos transaccionales ni push. El diseño usa datos reales y estados vacíos cuando todavía no hay registros.

## Carpetas

- `apps/admin`: panel administrativo web.
- `apps/mobile`: app del cliente web responsive; el nombre `mobile` se conserva por continuidad, **no contiene React Native ni Expo**.
- `supabase/migrations`: esquema y cambios de base de datos versionados.
- `supabase/seed.sql`: categorías de ejemplo; no crea datos comerciales ficticios.

Para desarrollo local opcional: `cd apps/admin && npm install && npm run dev` o `cd apps/mobile && npm install && npm run dev`, cada app con las variables en su propio `.env.local` (no subas ese archivo a GitHub).
