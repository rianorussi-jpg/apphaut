'use client';

import {useEffect,useMemo,useState} from 'react';
import {PublicPageShell} from '@/components/PublicPageShell';
import {supabase} from '@/lib/supabase';

function normalizePhone(value:string){
  let phone=value.replace(/\D/g,'');
  if(phone.length===10)phone=`52${phone}`;
  return phone.length>=10&&phone.length<=15?phone:'';
}

export default function SupportPage(){
  const [branchPhone,setBranchPhone]=useState('');
  useEffect(()=>{
    if(!supabase)return;
    let alive=true;
    (async()=>{
      let preferredBranchId:string|null=null;
      const {data:sessionData}=await supabase.auth.getSession();
      const userId=sessionData.session?.user.id;
      if(userId){
        const {data:profile}=await supabase.from('profiles').select('preferred_branch_id').eq('id',userId).maybeSingle();
        preferredBranchId=profile?.preferred_branch_id??null;
      }
      let query=supabase.from('branches').select('phone').eq('is_active',true);
      if(preferredBranchId)query=query.eq('id',preferredBranchId);
      const {data}=await query.order('name').limit(1).maybeSingle();
      if(alive)setBranchPhone(data?.phone??'');
    })();
    return()=>{alive=false;};
  },[]);
  const whatsapp=useMemo(()=>{
    const phone=normalizePhone(branchPhone||process.env.NEXT_PUBLIC_HAUT_WHATSAPP_NUMBER||'');
    if(!phone)return null;
    return `https://wa.me/${phone}?text=${encodeURIComponent('Hola, necesito ayuda con la app de HAUT Clinical.')}`;
  },[branchPhone]);

  return <PublicPageShell title="Soporte" eyebrow="HAUT · AYUDA">
    <section className="support-intro"><h2>¿Cómo podemos ayudarte?</h2><p>Encuentra respuestas rápidas sobre tu cuenta, tratamientos y citas. Si necesitas atención personalizada, escríbenos por WhatsApp.</p>{whatsapp?<a className="primary-button support-whatsapp" href={whatsapp} target="_blank" rel="noreferrer">Enviar mensaje por WhatsApp</a>:<p className="support-contact-note">El WhatsApp de soporte estará disponible cuando la sucursal tenga un número configurado.</p>}</section>
    <div className="support-faq-list">
      <section className="support-faq"><h3>¿Cómo entro a mi cuenta?</h3><p>Escribe el correo registrado en HAUT. Recibirás un código de 6 dígitos para iniciar sesión. La sesión permanecerá activa hasta que cierres sesión.</p></section>
      <section className="support-faq"><h3>No recibí mi código, ¿qué hago?</h3><p>Revisa spam o correo no deseado, confirma que escribiste correctamente tu correo y utiliza “Reenviar código” cuando esté disponible.</p></section>
      <section className="support-faq"><h3>¿Cómo cambio o cancelo una cita?</h3><p>Abre Mis citas → selecciona la cita → Enviar mensaje. El equipo de HAUT realizará el cambio desde recepción.</p></section>
      <section className="support-faq"><h3>¿Dónde veo mis sesiones?</h3><p>En Mis tratamientos puedes consultar el progreso, sesiones realizadas, próxima cita e información asociada a cada plan.</p></section>
      <section className="support-faq"><h3>¿Qué pasa cuando presiono Comprar?</h3><p>Se crea una solicitud de compra y HAUT te contactará por WhatsApp para confirmar los detalles. El tratamiento aparecerá en Mis tratamientos cuando recepción lo asigne.</p></section>
      <section className="support-faq"><h3>¿Cómo funciona mi cupón del 10%?</h3><p>Si tienes el cupón disponible, se reserva en tu primera solicitud de compra. Si esa solicitud se cancela sin asignarse, el cupón vuelve a quedar disponible.</p></section>
      <section className="support-faq"><h3>¿Cómo elimino mi cuenta?</h3><p>Ve a Perfil → Editar mis datos y presiona “Eliminar cuenta”. Antes de borrarla te pediremos confirmar porque la acción es irreversible.</p></section>
    </div>
  </PublicPageShell>;
}
