import {PublicPageShell} from '@/components/PublicPageShell';

export default function TermsPage(){
  return <PublicPageShell title="Términos y condiciones">
    <p className="legal-updated">Última actualización: 23 de octubre de 2026</p>
    <section className="legal-section"><h2>1. Uso de la aplicación</h2><p>HAUT Clinical pone esta aplicación a disposición de sus clientes para consultar tratamientos, planes activos, citas, paquetes y comunicaciones relacionadas con sus servicios. Al utilizarla, aceptas usarla de forma lícita y proporcionar información verdadera y actualizada.</p></section>
    <section className="legal-section"><h2>2. Cuenta y acceso</h2><p>El acceso se realiza mediante el correo asociado a tu cuenta y un código temporal. Eres responsable de mantener el acceso a tu correo y de no compartir códigos de autenticación con terceros.</p></section>
    <section className="legal-section"><h2>3. Citas y tratamientos</h2><p>La información mostrada en la aplicación sirve para dar seguimiento a los tratamientos y citas registrados por HAUT. Las fechas, duración, número de sesiones y demás condiciones pueden variar según la valoración y las indicaciones del equipo de HAUT.</p></section>
    <section className="legal-section"><h2>4. Paquetes y solicitudes de compra</h2><p>Cuando seleccionas “Comprar” en un paquete, envías una solicitud de compra. La operación no se considera concluida hasta que HAUT te contacte, confirme las condiciones aplicables y asigne el tratamiento a tu cuenta. Los precios y beneficios mostrados pueden estar sujetos a las condiciones informadas en cada paquete.</p></section>
    <section className="legal-section"><h2>5. Cupón de bienvenida</h2><p>Cuando esté disponible, el cupón de bienvenida se reserva al enviar la primera solicitud de compra. Si HAUT cancela esa solicitud antes de asignar el tratamiento, el cupón puede volver a estar disponible. Una vez asignada la compra, el beneficio se considera utilizado.</p></section>
    <section className="legal-section"><h2>6. Cambios y cancelaciones</h2><p>Los cambios, cancelaciones o reprogramaciones de citas se gestionan con el equipo de HAUT. La aplicación puede facilitar el contacto, pero la modificación queda confirmada únicamente cuando recepción la registra.</p></section>
    <section className="legal-section"><h2>7. Información de salud</h2><p>La aplicación no sustituye una valoración profesional ni está diseñada para atender emergencias médicas. Las recomendaciones o notas asociadas a un tratamiento deben interpretarse dentro del seguimiento brindado por HAUT.</p></section>
    <section className="legal-section"><h2>8. Disponibilidad del servicio</h2><p>HAUT puede actualizar, corregir o suspender temporalmente funciones de la aplicación por mantenimiento, seguridad o mejoras del servicio.</p></section>
    <section className="legal-section"><h2>9. Cuenta y terminación</h2><p>Puedes eliminar tu cuenta desde Perfil → Editar mis datos → Eliminar cuenta. La eliminación borra el acceso y la información asociada que no sea necesario conservar por una obligación legal o administrativa aplicable.</p></section>
    <section className="legal-section"><h2>10. Contacto</h2><p>Para dudas sobre la aplicación, citas o tratamientos, utiliza la sección de Soporte o comunícate con tu sucursal HAUT.</p></section>
  </PublicPageShell>;
}
