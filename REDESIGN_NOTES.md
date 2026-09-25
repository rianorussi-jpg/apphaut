# HAUT Clinical · renovación de experiencia

Esta entrega actualiza los dos frontends existentes y mantiene las rutas, el esquema de Supabase, las migraciones y la lógica de negocio del último proyecto entregado. No usa Expo ni Capacitor.

## Mobile web (`apps/mobile`)
- Inicio: carrusel navegable con promociones reales leídas de `promotions`, enlaces hacia tratamiento o listado de promociones. Sin promociones, bienvenida sin oferta ficticia.
- Accesos directos: citas, planes de tratamiento y Rewards. Próxima cita real y progreso desde los planes asignados.
- Menú inferior: iconos SVG originales consistentes, estados activos, cinco secciones aprobadas.
- Catálogo: filtros comerciales existentes + búsqueda por nombre; tarjetas con imágenes guardadas en `treatments.image_url` y estado de imagen pendiente cuando no existe.
- Detalle: encabezado visual, información, recomendaciones y solicitud por WhatsApp (sin reserva desde el cliente).
- Citas: tarjetas con fecha, hora, estado, sucursal y detalle accesible; botón de vuelta editorial; enlace al plan cuando corresponde.
- Mis tratamientos: seguimiento por sesión con progreso calculado a partir de sesiones y enlaces a cita; no crea ni modifica reservas.
- Rewards, promociones y perfil: diseño renovado y accesos funcionales. Botón de recarga de datos.

## Admin (`apps/admin`)
- Menú con iconos SVG y estados activos, encabezado y dashboard renovados.
- Ajustes visuales para agenda, formularios y tarjetas ya existentes. Se conservan creación de citas y edición de tratamientos del código de origen.
- Promociones: formulario contextual, subida de fotografía al bucket preexistente `treatment-images`, vista previa y asociación opcional con un tratamiento. Los permisos de publicación continúan gobernados por RLS.

## Despliegue
Sube el contenido del proyecto al repositorio actual. Vercel Admin: Root Directory `apps/admin`. Vercel Mobile: Root Directory `apps/mobile`. Conserva las variables `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` de ambos proyectos y `NEXT_PUBLIC_HAUT_WHATSAPP_NUMBER` de Mobile. No hay SQL nuevo ni cambios en los permisos de Supabase.

## Verificación pendiente
El parser de TypeScript pudo comprobar la sintaxis, pero no se pudo completar `npm install` ni el build completo de Next.js en este entorno. La comprobación end-to-end de Supabase, roles, datos del cliente y publicación de promociones debe realizarse con el proyecto real en Vercel; esta entrega no puede garantizar resultados de integración sin acceder a esa instancia.

### Agenda: sucursal fija y cabina estricta

- El selector de clientes de una cita ahora se limita a la sucursal de la agenda.
- La sucursal se muestra como dato fijo dentro del modal.
- El clic sobre una celda de cabina ya no permite fallback a otra cabina: los conflictos se reportan para que recepción corrija el horario/cabina.
- Tratamientos pendientes de completar en catálogo sí aparecen en las listas administrativas; las relaciones de sucursal/cabina se sincronizan con la nueva migración incremental.
