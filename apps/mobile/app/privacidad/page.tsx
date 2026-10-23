import {PublicPageShell} from '@/components/PublicPageShell';

export default function PrivacyPage(){
  return <PublicPageShell title="Política de privacidad">
    <p className="legal-updated">Última actualización: 23 de octubre de 2026</p>
    <section className="legal-section"><h2>1. Responsable</h2><p>HAUT Clinical Center es responsable del tratamiento de la información utilizada para operar tu cuenta y brindarte las funciones disponibles en esta aplicación.</p></section>
    <section className="legal-section"><h2>2. Información que utilizamos</h2><p>La aplicación puede tratar datos como nombre, correo electrónico, número de teléfono, fecha de nacimiento y sucursal preferida. También registra información necesaria para mostrar tus tratamientos, sesiones, citas, solicitudes de compra y comunicaciones relacionadas con tu atención.</p></section>
    <section className="legal-section"><h2>3. Para qué usamos tus datos</h2><p>Utilizamos esta información para identificar tu cuenta, gestionar citas y planes de tratamiento, dar seguimiento a solicitudes de compra, enviarte comunicaciones operativas, mostrar promociones o paquetes disponibles y mantener la seguridad del servicio.</p></section>
    <section className="legal-section"><h2>4. Proveedores tecnológicos</h2><p>Para operar la aplicación pueden intervenir proveedores tecnológicos que prestan servicios de autenticación, base de datos, alojamiento y correo electrónico, entre ellos Supabase, Vercel y Zoho. Estos proveedores procesan información únicamente en la medida necesaria para prestar sus servicios a HAUT.</p></section>
    <section className="legal-section"><h2>5. Seguridad</h2><p>El acceso a la cuenta utiliza autenticación por correo y controles de acceso en el backend. HAUT aplica medidas técnicas y organizativas orientadas a proteger la información frente a accesos no autorizados, alteración o pérdida.</p></section>
    <section className="legal-section"><h2>6. Conservación</h2><p>Conservamos la información mientras tu cuenta permanezca activa o mientras sea necesaria para prestar los servicios solicitados. Determinados registros pueden conservarse cuando exista una obligación legal, administrativa, contractual o de resolución de controversias.</p></section>
    <section className="legal-section"><h2>7. Eliminación de cuenta</h2><p>Puedes solicitar la eliminación directamente desde Perfil → Editar mis datos → Eliminar cuenta. Al confirmar, se elimina tu acceso y los datos de la cuenta que pueden ser eliminados de acuerdo con las obligaciones aplicables.</p></section>
    <section className="legal-section"><h2>8. Tus datos</h2><p>Puedes actualizar tus datos básicos desde tu perfil. Para dudas adicionales sobre privacidad o sobre información asociada a tu cuenta, comunícate con HAUT desde la página de Soporte.</p></section>
    <section className="legal-section"><h2>9. Cambios a esta política</h2><p>Esta política puede actualizarse para reflejar cambios en la aplicación, en nuestros procesos o en requisitos aplicables. La versión vigente estará disponible siempre en esta misma página.</p></section>
  </PublicPageShell>;
}
