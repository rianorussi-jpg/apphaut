'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import {Icon} from '../../../components/Icon';

type PurchaseRequest={
 id:string;user_id:string;treatment_id:string;branch_id:string;plan_id:string|null;
 status:'pending'|'contacted'|'assigned'|'cancelled';session_count:number;duration_minutes:number;
 quoted_amount:number|string;contacted_at:string|null;assigned_at:string|null;created_at:string;
};
type Profile={id:string;full_name:string|null;phone:string|null};
type Treatment={id:string;name:string};
type Branch={id:string;name:string;phone:string|null};

type PurchaseView=PurchaseRequest&{clientName:string;clientPhone:string|null;treatmentName:string;branchName:string};

const money=(value:number|string)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(value)||0);
const dateTime=(value:string)=>new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(value));
function whatsappHref(phone:string|null,name:string,treatment:string){
 let digits=(phone||'').replace(/\D/g,'');
 if(digits.length===10)digits=`52${digits}`;
 if(digits.length<10||digits.length>15)return null;
 const firstName=name.trim().split(/\s+/)[0]||'Hola';
 const message=`Hola ${firstName}, te contactamos de HAUT Clinical por tu solicitud de compra de ${treatment}. Queremos ayudarte a concretarla y resolver cualquier duda que tengas.`;
 return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

export default function PurchasesPage(){
 const [items,setItems]=useState<PurchaseView[]>([]);
 const [loading,setLoading]=useState(true);
 const [workingId,setWorkingId]=useState<string|null>(null);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');

 const load=useCallback(async()=>{
  if(!supabase)return;
  setError('');
  try{
   const requestsResult=await supabase.from('treatment_purchase_requests')
    .select('id,user_id,treatment_id,branch_id,plan_id,status,session_count,duration_minutes,quoted_amount,contacted_at,assigned_at,created_at')
    .order('created_at',{ascending:false}).limit(300);
   if(requestsResult.error)throw requestsResult.error;
   const requests=(requestsResult.data??[]) as PurchaseRequest[];
   if(!requests.length){setItems([]);return;}
   const unique=(values:string[])=>[...new Set(values)];
   const [profilesResult,treatmentsResult,branchesResult]=await Promise.all([
    supabase.from('profiles').select('id,full_name,phone').in('id',unique(requests.map(r=>r.user_id))),
    supabase.from('treatments').select('id,name').in('id',unique(requests.map(r=>r.treatment_id))),
    supabase.from('branches').select('id,name,phone').in('id',unique(requests.map(r=>r.branch_id))),
   ]);
   if(profilesResult.error)throw profilesResult.error;
   if(treatmentsResult.error)throw treatmentsResult.error;
   if(branchesResult.error)throw branchesResult.error;
   const profiles=new Map(((profilesResult.data??[]) as Profile[]).map(row=>[row.id,row]));
   const treatments=new Map(((treatmentsResult.data??[]) as Treatment[]).map(row=>[row.id,row]));
   const branches=new Map(((branchesResult.data??[]) as Branch[]).map(row=>[row.id,row]));
   setItems(requests.map(request=>({
    ...request,
    clientName:profiles.get(request.user_id)?.full_name||'Cliente sin nombre',
    clientPhone:profiles.get(request.user_id)?.phone||null,
    treatmentName:treatments.get(request.treatment_id)?.name||'Tratamiento',
    branchName:branches.get(request.branch_id)?.name||'Sucursal',
   })));
  }catch(cause){
   setError(cause instanceof Error?cause.message:'No se pudieron cargar las solicitudes de compra.');
  }finally{setLoading(false);}
 },[]);

 useEffect(()=>{void load();const timer=window.setInterval(()=>void load(),30000);return()=>window.clearInterval(timer);},[load]);

 const pending=useMemo(()=>items.filter(i=>i.status==='pending'),[items]);
 const contacted=useMemo(()=>items.filter(i=>i.status==='contacted'),[items]);
 const assigned=useMemo(()=>items.filter(i=>i.status==='assigned'),[items]);

 async function markContacted(id:string){
  if(!supabase)return;
  setWorkingId(id);setError('');setSuccess('');
  const {error:rpcError}=await supabase.rpc('admin_mark_purchase_request_contacted',{p_request_id:id});
  setWorkingId(null);
  if(rpcError){setError(rpcError.message);return;}
  setSuccess('Solicitud marcada como contactada.');
  await load();
 }

 async function assign(id:string){
  if(!supabase)return;
  setWorkingId(id);setError('');setSuccess('');
  const {error:rpcError}=await supabase.rpc('admin_assign_purchase_request',{p_request_id:id});
  setWorkingId(null);
  if(rpcError){setError(rpcError.message);return;}
  setSuccess('Tratamiento asignado correctamente. Ya aparece en Mis tratamientos y no se creó ninguna cita.');
  await load();
 }

 function RequestCard({item}:{item:PurchaseView}){
  const wa=whatsappHref(item.clientPhone,item.clientName,item.treatmentName);
  const busy=workingId===item.id;
  return <article className="purchase-request-card">
   <div className="purchase-request-main">
    <div className="purchase-request-heading"><div><span className={`purchase-state purchase-${item.status}`}>{item.status==='pending'?'Pendiente de contacto':item.status==='contacted'?'Contactado':item.status==='assigned'?'Asignado':'Cancelado'}</span><h3>{item.clientName}</h3></div>{Number(item.quoted_amount)>0&&<strong>{money(item.quoted_amount)}</strong>}</div>
    <div className="purchase-request-treatment"><span className="purchase-request-icon"><Icon name="sparkles" size={18}/></span><div><strong>{item.treatmentName}</strong><span>{item.session_count} {item.session_count===1?'sesión':'sesiones'} · {item.duration_minutes} min por sesión</span></div></div>
    <div className="purchase-request-meta"><span><b>Sucursal</b>{item.branchName}</span><span><b>Teléfono</b>{item.clientPhone||'Sin teléfono'}</span><span><b>Solicitud</b>{dateTime(item.created_at)}</span>{item.contacted_at&&<span><b>Contactado</b>{dateTime(item.contacted_at)}</span>}</div>
   </div>
   <div className="purchase-request-actions">
    {wa?<a className="secondary-button" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16}/> Enviar WhatsApp</a>:<button className="secondary-button" type="button" disabled>Sin WhatsApp</button>}
    {item.status==='pending'&&<button className="secondary-button" type="button" onClick={()=>void markContacted(item.id)} disabled={busy}>{busy?'Guardando…':'Marcar contactado'}</button>}
    {item.status!=='assigned'&&item.status!=='cancelled'&&<button className="primary-button" type="button" onClick={()=>void assign(item.id)} disabled={busy}>{busy?'Asignando…':'Asignar tratamiento'}</button>}
    {item.status==='assigned'&&<span className="purchase-assigned-note"><Icon name="check" size={16}/> Tratamiento asignado</span>}
   </div>
  </article>;
 }

 return <section className="page-stack">
  <div className="page-heading"><p className="eyebrow">Seguimiento comercial</p><h2>Compras</h2><p className="muted">Solicitudes enviadas desde la app. Contacta al cliente por WhatsApp y asigna el tratamiento cuando la compra quede concretada.</p></div>
  {error&&<div className="alert error-alert">{error}</div>}
  {success&&<div className="alert">{success}</div>}
  <section className="stats purchase-stats"><article><span>Pendientes de contacto</span><strong>{loading?'—':pending.length}</strong><small>Necesitan mensaje</small></article><article><span>Contactados</span><strong>{loading?'—':contacted.length}</strong><small>En seguimiento</small></article><article><span>Asignados</span><strong>{loading?'—':assigned.length}</strong><small>Compra concretada</small></article><article><span>Solicitudes</span><strong>{loading?'—':items.length}</strong><small>Histórico visible</small></article></section>
  {loading?<div className="fullscreen-inline"><div className="spinner"/></div>:<>
   <section className="panel-card"><div className="section-heading"><div><p className="eyebrow">Por atender</p><h3>Pendientes de enviar mensaje</h3></div><span className="purchase-count-pill">{pending.length}</span></div>{pending.length?<div className="purchase-request-list">{pending.map(item=><RequestCard key={item.id} item={item}/>)}</div>:<div className="empty-state"><strong>No hay compras pendientes de contacto.</strong><span>Las nuevas solicitudes aparecerán aquí automáticamente.</span></div>}</section>
   <section className="panel-card"><div className="section-heading"><div><p className="eyebrow">Seguimiento</p><h3>Contactados</h3></div><span className="purchase-count-pill">{contacted.length}</span></div>{contacted.length?<div className="purchase-request-list">{contacted.map(item=><RequestCard key={item.id} item={item}/>)}</div>:<div className="empty-state"><strong>No hay solicitudes en seguimiento.</strong></div>}</section>
   <section className="panel-card"><div className="section-heading"><div><p className="eyebrow">Historial</p><h3>Tratamientos asignados</h3></div><span className="purchase-count-pill">{assigned.length}</span></div>{assigned.length?<div className="purchase-request-list compact-purchase-history">{assigned.map(item=><RequestCard key={item.id} item={item}/>)}</div>:<div className="empty-state"><strong>Todavía no hay compras asignadas.</strong></div>}</section>
  </>}
 </section>;
}
