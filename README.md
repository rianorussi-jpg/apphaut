# Haut Clinical — Admin + Mobile Web

Repositorio preparado para GitHub + Vercel + Supabase Cloud.

## Estructura

- `apps/admin`: panel administrativo Next.js. Fase 3: login real, rol, dashboard, agenda y módulos de lectura conectados a Supabase.
- `apps/mobile`: app web responsive del cliente. Se mantiene como la entrega anterior y se continuará después.
- `supabase`: esquema, RLS, seed y configuración versionada.

## No vuelvas a ejecutar el SQL inicial si ya lo corriste

Si en tu proyecto Supabase ya ejecutaste:

1. `supabase/migrations/20260918140000_initial_schema.sql`
2. `supabase/seed.sql`

no necesitas repetirlos para esta entrega. Esta fase no agrega una migración nueva.

## Usuario administrador

El login del admin usa Supabase Auth y valida `public.user_roles`.

El usuario debe existir en `Authentication > Users` y tener, por ejemplo:

```sql
insert into public.user_roles (user_id, role)
values ('UUID_DEL_USUARIO', 'superadmin');
```

Si ya lo hiciste, no lo repitas.

## Vercel — Admin

Crea/importa un proyecto desde el repositorio de GitHub.

- Root Directory: `apps/admin`
- Framework Preset: `Next.js`
- Build Command: Default
- Output Directory: Default (NO `public`)
- Install Command: Default

Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Al abrir el deployment, `/` redirige a `/dashboard`; si no hay sesión, el panel envía a `/login`.

## Vercel — Mobile web

Crea un segundo proyecto de Vercel apuntando al mismo repositorio:

- Root Directory: `apps/mobile`
- Framework Preset: `Next.js`
- Build/Output/Install: Default

Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU-PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

## Qué ya funciona en el admin

- Login con correo/contraseña de Supabase Auth.
- Validación del rol `superadmin`, `branch_admin` o `reception`.
- Persistencia de sesión de Supabase en navegador.
- Cerrar sesión.
- Navegación real por URLs.
- Dashboard con conteos reales de sucursales, citas y planes activos.
- Agenda Día y Semana.
- Selector de sucursal, fecha, Hoy, anterior/siguiente.
- Columnas dinámicas según las cabinas reales de la sucursal.
- Bloques de cita según duración.
- Detalle de cita.
- Listado de citas Próximas/Historial.
- Clientes derivados de planes reales.
- Tratamientos reales.
- Sucursales/cabinas reales.
- Horarios y bloqueos reales.
- RLS continúa siendo la capa de seguridad de datos.

## Importante sobre datos vacíos

El `seed.sql` solo crea categorías de tratamiento. No crea sucursales, cabinas, tratamientos ni citas ficticias. Si todavía no has cargado datos operativos reales en Supabase, el panel mostrará `0` o estados vacíos. Eso confirma que ya no está usando datos hardcodeados.

## Siguiente etapa

Las acciones de escritura administrativa (crear cita, confirmar/finalizar, cancelar, reagendar, alta/edición de tratamientos, sucursales, horarios y usuarios) requieren funciones transaccionales/políticas específicas y se incorporan después de esta base de autenticación y lectura real.
