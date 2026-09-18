# Haut Clinical — Admin + Cliente Web

Este repositorio contiene dos aplicaciones web independientes listas para desplegar desde el mismo repositorio de GitHub a dos proyectos distintos de Vercel.

## Estructura

- `apps/admin` — panel administrativo Next.js
- `apps/mobile` — experiencia del cliente responsive Next.js (preview web; no Expo/Capacitor por ahora)
- `supabase` — esquema, migraciones, seed y config del backend

## Supabase

Primero ejecuta en Supabase SQL Editor:

1. `supabase/migrations/20260918140000_initial_schema.sql`
2. `supabase/seed.sql`

`supabase/config.toml` se conserva en el repositorio y no se ejecuta en SQL Editor.

## Variables de entorno

En AMBOS proyectos de Vercel usa los mismos nombres y valores:

```env
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

No expongas una `service_role` ni una secret key como `NEXT_PUBLIC_*`.

## Deploy en Vercel

Crea dos proyectos en Vercel apuntando al mismo repositorio de GitHub.

### Proyecto 1 — Admin

- Root Directory: `apps/admin`
- Framework Preset: Next.js (autodetect)
- Build Command: dejar automático
- Install Command: dejar automático
- Variables: las dos `NEXT_PUBLIC_SUPABASE_*`

### Proyecto 2 — Cliente

- Root Directory: `apps/mobile`
- Framework Preset: Next.js (autodetect)
- Build Command: dejar automático
- Install Command: dejar automático
- Variables: las mismas dos `NEXT_PUBLIC_SUPABASE_*`

No existe Expo ni React Native en este repositorio. `apps/mobile` es una web responsive para poder revisar el producto en Vercel. La decisión sobre empaquetado nativo se tomará después.

## Navegación del cliente

La barra inferior es:

- Inicio
- Tratamientos
- Mis tratamientos
- Mis citas
- Perfil

`Reservar` no es un tab. Es un flujo contextual que se abre desde Tratamientos o Mis tratamientos.

## Estado actual

Esta entrega mantiene la Fase 2: estructura web, navegación, Supabase preparado y wireframes funcionales. La autenticación real (incluido login del superadmin) corresponde a la Fase 3.
