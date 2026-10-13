'use client';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {MobileShell} from '@/components/MobileShell';
import {useClient} from '@/components/ClientProvider';
import {currency,whatsappHref} from '@/lib/client-data';
import {supabase} from '@/lib/supabase';
import {Icon} from '@/components/Icon';
import {BackLink} from '@/components/BackLink';

export default function TreatmentDetail(){
 const {treatmentId}=useParams<{treatmentId:string}>();
 const {data,refresh}=useClient();
 const [buying,setBuying]=useState(false);
 const [purchaseReturning,setPurchaseReturning]=useState(false);
 const [purchaseError,setPurchaseError]=useState('');
 const [purchaseMessage,setPurchaseMessage]=useState('');
 const t=data?.treatments.find(t=>t.id===treatmentId);
 useEffect(()=>{
  const compra=new URLSearchParams(window.location.search).get('compra');
  if(compra==='pendiente'){setPurchaseMessage('Tu pago está pendiente de confirmación en Mercado Pago. El tratamiento aparecerá en Mis tratamientos cuando quede acreditado.');return;}
  if(compra==='fallida'){setPurchaseMessage('El pago no se completó. Puedes intentarlo nuevamente cuando quieras.');return;}
  if(compra!=='exitosa')return;
  setPurchaseMessage('Pago recibido. Estamos confirmándolo con Mercado Pago…');
  setPurchaseReturning(true);
  void refresh();
  const t1=window.setTimeout(()=>void refresh(),1800);
  const t2=window.setTimeout(()=>void refresh(),4500);
  const t3=window.setTimeout(()=>{void refresh();setPurchaseReturning(false);},8000);
  return()=>{window.clearTimeout(t1);window.clearTimeout(t2);window.clearTimeout(t3);};
 },[refresh]);
 if(!data)return <MobileShell title="Tratamiento"><div className="empty-card">Cargando información…</div></MobileShell>;
 if(!t)return <MobileShell title="Tratamiento"><BackLink href="/tratamientos" label="Catálogo"/><div className="empty-card">No encontramos este tratamiento.</div></MobileShell>;
 const phone=data.branches.find(b=>b.id===data.profile?.preferred_branch_id)?.phone;
 const whatsapp=whatsappHref(t.name,phone);
 const assigned=data.plans.find(p=>p.treatment_id===t.id&&['active','paused'].includes(p.status));
 const backHref=t.is_package?'/':'/tratamientos';
 const backLabel=t.is_package?'Paquetes':'Explorar tratamientos';
 const canBuy=t.is_sold_in_app&&!assigned;
 async function buy(){
  if(!supabase||!canBuy)return;
  setBuying(true);setPurchaseError('');
  try{
   const {data:checkout,error}=await supabase.functions.invoke('create-treatment-checkout',{body:{treatment_id:t.id}});
   if(error)throw error;
   if(!checkout?.url)throw new Error(checkout?.error||'No se pudo abrir el pago.');
   window.location.assign(checkout.url);
  }catch(error){
   setPurchaseError(error instanceof Error?error.message:'No se pudo iniciar la compra.');
   setBuying(false);
  }
 }
 return <MobileShell title="Conoce tu tratamiento" eyebrow="HAUT · TRATAMIENTOS">
  <BackLink href={backHref} label={backLabel}/>
  <div className="treatment-detail-visual">{t.image_url?<img src={t.image_url} alt={t.name}/>:<div className="detail-photo-empty"><Icon name="image" size={32}/><span>Fotografía próximamente</span></div>}<span className="detail-visual-tag">{t.is_package?'PAQUETE · HAUT':'HAUT · CLINICAL CENTER'}</span></div>
  <div className="detail-intro"><span className="eyebrow">TU EXPERIENCIA HAUT</span><h2 className="detail-title">{t.name}</h2></div>
  <div className="detail-facts"><div><Icon name="calendar" size={20}/><span>Sesiones</span><strong>{t.catalog_details_pending?'Por confirmar':t.default_session_count}</strong></div><div><Icon name="clock" size={20}/><span>Duración</span><strong>{t.catalog_details_pending?'Por confirmar':`${t.default_duration_minutes} min`}</strong></div><div><Icon name="info" size={20}/><span>Inversión</span><strong>{t.catalog_details_pending?'Consultar':currency(t.base_price)}</strong></div></div>
  {!t.catalog_details_pending&&<p className="detail-variation-note">Sesiones y duración de referencia · pueden variar según el plan indicado para ti.</p>}
  {t.is_sold_in_app&&<section className="purchase-card"><span className="eyebrow">COMPRA DIRECTA · HAUT</span><div className="purchase-card-top"><div><h3>{assigned?'Ya forma parte de tus tratamientos':'Adquiérelo desde la app'}</h3>{!assigned&&<p>Tu compra incluye <strong>{t.purchase_session_count} {t.purchase_session_count===1?'sesión':'sesiones'}</strong> de <strong>{t.purchase_duration_minutes} min</strong>. HAUT programará tu primera cita después de la compra.</p>}</div><strong className="purchase-price">{currency(t.base_price)}</strong></div>{purchaseMessage&&<div className="alert">{purchaseMessage}</div>}{purchaseError&&<div className="alert error-alert" role="alert">{purchaseError}</div>}{assigned?<Link className="primary-button" href={`/mis-tratamientos/${assigned.id}`}>Ver mi tratamiento <Icon name="forward" size={17}/></Link>:purchaseReturning?<button type="button" className="primary-button" disabled>Confirmando tu compra…</button>:<button type="button" className="primary-button" onClick={()=>void buy()} disabled={buying}>{buying?'Abriendo pago…':'Comprar'} <Icon name="arrow" size={17}/></button>}<small>El tratamiento se agrega a “Mis tratamientos” únicamente cuando el pago queda confirmado. La compra no crea una cita automáticamente.</small></section>}
  <section className="detail-section"><div className="detail-section-heading"><span className="eyebrow">01 · EL TRATAMIENTO</span><h3>Conócelo mejor</h3></div><p>{t.description||'Nuestro equipo puede orientarte sobre los detalles, cuidados y disponibilidad de este tratamiento.'}</p></section>
  {t.recommendations&&<section className="detail-section"><div className="detail-section-heading"><span className="eyebrow">02 · A TENER EN CUENTA</span><h3>Recomendaciones</h3></div><p>{t.recommendations}</p></section>}
  {t.contraindications&&<section className="detail-section"><div className="detail-section-heading"><span className="eyebrow">CUIDADO PERSONALIZADO</span><h3>Consideraciones</h3></div><p>{t.contraindications}</p></section>}
  <div className="detail-branch"><span className="detail-branch-icon"><Icon name="pin" size={20}/></span><div><strong>Atención en nuestras sucursales</strong><p>Pregunta por la disponibilidad de este tratamiento en tu sucursal HAUT.</p></div></div>
  <div className="detail-sticky-actions">{whatsapp?<a href={whatsapp} className={t.is_sold_in_app?'secondary-button':'primary-button'} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={19}/> Solicitar información <Icon name="arrow" size={17}/></a>:!t.is_sold_in_app&&<div className="empty-card">Haut aún no ha configurado un número de WhatsApp para consultas.</div>}{assigned&&!t.is_sold_in_app&&<Link className="secondary-button" href={`/mis-tratamientos/${assigned.id}`}>Ver mi tratamiento asignado <Icon name="forward" size={17}/></Link>}<p className="small-print">La programación de citas se realiza directamente con el equipo de HAUT.</p></div>
 </MobileShell>;
}
