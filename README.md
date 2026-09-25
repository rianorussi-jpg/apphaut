# HAUT Clinical · Admin + Mobile Web

## Actualización: carrusel fotográfico y encuadre de promociones (20 sep 2026)

- **Mobile → Inicio:** banner con la fotografía completa sin oscurecer, sin título ni descripción superpuestos, flechas e indicadores, y cambio automático cada 5 segundos. El botón **Ver promoción** va debajo de la imagen y abre el detalle de la promoción. La app muestra después **Mis tratamientos → Tu próxima cita → Para descubrir**; se quitaron los accesos rápidos y la tarjeta de Rewards intermedia de Inicio (Rewards sigue disponible en Perfil).
- **Admin → Promociones:** nuevo botón **Editar** en cada promoción; permite modificar título, descripción, tratamiento relacionado e imagen sin crear registros duplicados. El editor permite zoom (1–3×), arrastrar, desplazar y previsualizar el encuadre real 16:9. La fotografía se guarda recortada como WebP de **1200 × 675 px** en el bucket `treatment-images`. Las imágenes anteriores permanecen igual hasta que se editen.
- **Sin SQL nuevo:** se utiliza `promotions.image_url`, los permisos y el bucket existentes. No vuelvas a correr migraciones ni `seed.sql`. No se necesitan variables de entorno adicionales.
- Sube el proyecto completo a GitHub para actualizar los dos despliegues de Vercel: `apps/admin` y `apps/mobile`. Mantén sus variables de Supabase existentes.
- Para imágenes alojadas en servidores externos que impidan exportarlas desde el navegador (CORS), **vuelve a seleccionar el archivo desde tu computadora** antes de guardar un nuevo encuadre.

---


**Renovación visual y de experiencia (20 de septiembre de 2026):** esta versión incluye carrusel de promociones en Inicio, menú con iconos, fichas de tratamientos, citas, planes, Rewards, perfil y panel Admin renovados. La administración de promociones permite subir fotografía y vincular un tratamiento usando el bucket de imágenes existente. **Si ya tienes las migraciones previas aplicadas, no ejecutes ningún SQL nuevo ni vuelvas a correr el seed.** Reemplaza el código en GitHub y Vercel publicará los dos proyectos. Consulta `REDESIGN_NOTES.md` para los cambios y límites de validación.

---

# Haut Clinical — Admin + app web de clientes

## Actualización del catálogo (20 de septiembre de 2026)

**Solo en tu proyecto real de Supabase de HAUT**, abre SQL Editor y ejecuta **únicamente** el archivo nuevo
`supabase/migrations/20260920090000_catalogo_haut.sql`, después de tener aplicadas tus
migraciones anteriores. **No repitas** `initial_schema.sql`, `admin_booking.sql`,
`client_app.sql` ni `seed.sql` sobre una base que ya está en uso. Esta actualización es
transaccional y no borra citas, planes ni usuarios existentes.

Después sube este repositorio a GitHub; Vercel actualizará sus dos proyectos:
`apps/admin` y `apps/mobile`. No se necesitan variables de entorno nuevas.

El catálogo del cliente mostrará **Todos, Favoritos, Depilación láser, Corporales y
Faciales**. Las tres categorías reales son Depilación láser, Corporales y Faciales;
Favoritos es un filtro de `treatments.is_featured`. La migración agrega hasta 17 tratamientos
sin duplicar los que ya tienen el mismo slug/nombre y fija como favoritos *Limpieza facial,
Cavitación y Hollywood peel*. Los tratamientos que ya existían conservan sus precios,
sesiones y duración. Otras categorías anteriores quedan inactivas, pero sus tratamientos,
citas y planes no se borran.

**No se proporcionaron precios, duración ni cantidad de sesiones para los 17 tratamientos.**
Los registros **nuevos** se cargan con valores operativos provisionales (`0 MXN`, `60 min`,
`1 sesión`) y `catalog_details_pending = true`. La app **no muestra esos valores**; muestra
"por confirmar" y permite *Solicitar información* por WhatsApp. En Admin → Tratamientos,
usa **Configurar / editar datos** para completar sus datos reales. Mientras están pendientes,
no pueden asignarse a clientes ni reservarse. Confirmar esos datos no asigna automáticamente
cabinas o sucursales: eso deberá configurarse con información real de HAUT antes de agendar.

Para nuevas instalaciones, `seed.sql` ya contiene únicamente las tres categorías oficiales;
los tratamientos se insertan con esta nueva migración. Si aún no has aplicado las otras
migraciones en una instalación nueva, hazlo en orden cronológico.

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

## Actualización 2026-09-20 — Clientes y editor visual de tratamientos

Esta entrega conserva las dos aplicaciones Next.js existentes (`apps/admin`, `apps/mobile`), el catálogo, citas y planes, y no vuelve a ejecutar las migraciones anteriores. Para el **mismo proyecto Supabase de HAUT**, ejecutar **solo** `supabase/migrations/20260920150000_client_directory_and_catalog_editor.sql` desde SQL Editor **antes de usar el editor o volver a abrir el directorio**. El archivo incluye `begin/commit`: en caso de error no es necesario ejecutar comandos de limpieza manuales.

La migración rellena solamente perfiles de usuarios existentes que falten (sin modificar perfiles actuales), vuelve a publicar la función `admin_booking_clients` con comprobación de rol/sucursal y habilita inserción/edición de fichas y vínculos de sucursales/cabinas **exclusivamente para superadmin por RLS**. No modifica citas, planes, sesiones ni recompensas.

Admin → Clientes y Agenda → Nueva cita consultan la misma función. Si algo falla, ahora muestran el mensaje específico de Supabase y el directorio no desaparece si solo falla la consulta secundaria de planes o tratamientos. Los administradores de sucursal/recepción ven únicamente clientes asociados a sucursales autorizadas; el superadmin ve los clientes sin rol administrativo.

Admin → Tratamientos: la lista inicial no muestra el formulario. «+ Agregar nuevo tratamiento» o «Editar tratamiento» abren un editor con foto, categoría, precio, duración, sesiones, intervalo, favoritos, estado y sucursales/cabinas. El editor permite subir archivos JPG/PNG/WebP/AVIF de hasta 10 MB al bucket público **`treatment-images`** ya creado por la migración inicial; la URL pública queda en `treatments.image_url` y Mobile la muestra al recargar. Los registros sin foto dicen «Fotografía pendiente» en vez de «HAUT». No uses `service_role` ni nuevas variables de entorno para Storage.

Si un tratamiento está asignado a citas/planes existentes, editar sus valores predeterminados no altera los valores históricos guardados en el plan/sesión/cita. No desactives relaciones de sucursal/cabina que se necesiten para futuras reservas.

Vercel: ambos proyectos siguen apuntando al **mismo repositorio**, con directorios raíz `apps/admin` y `apps/mobile` respectivamente. Esta actualización no requiere cambiar las variables Supabase. No vuelvas a correr la migración inicial, `seed.sql` ni el SQL del catálogo.

## Actualización 25 Sep 2026 — continuidad de tratamientos y solicitud de cita

Esta versión agrega:

- Tratamientos activos visibles en **Admin → Clientes**, con progreso y próxima cita.
- Botón **Agendar próxima cita** cuando el plan tiene una sesión habilitada y todavía no existe otra cita activa.
- En **Agenda → Nueva cita**, después de elegir cliente aparecen primero sus tratamientos iniciados; los que ya tienen próxima cita se muestran bloqueados. También se puede iniciar un tratamiento diferente.
- La app del cliente refleja las citas creadas por administración y refresca sus datos mientras está abierta.
- En **Mis tratamientos → Próxima sesión**, cuando no existe cita y la siguiente sesión está habilitada, el cliente elige un día de la semana y abre WhatsApp de su sucursal con un mensaje preparado.
- **Admin → Sucursales** permite configurar el número de WhatsApp de cada sucursal.
- Todos los tratamientos activos quedan asociados a todas las sucursales activas. Si una combinación tratamiento+sucursal no tenía cabinas configuradas, se habilitan inicialmente todas las cabinas activas de esa sucursal para que la agenda pueda asignar una.

### SQL incremental

Ejecuta una sola vez en Supabase SQL Editor:

`supabase/migrations/20260925004000_plan_booking_requests_all_branches.sql`

No vuelvas a ejecutar las migraciones anteriores ni `seed.sql`.
