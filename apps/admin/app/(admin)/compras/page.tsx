'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import {Icon} from '../../../components/Icon';

type PurchaseRequest={
 id:string;user_id:string;treatment_id:string;branch_id:string;plan_id:string|null;
 status:'pending'|'contacted'|'assigned'|'cancelled';session_count:number|null;duration_minutes:number|null;
 quoted_amount:number|string;uses_welcome_coupon:boolean;coupon_discount_percent:number;
 contacted_at:string|null;assigned_at:string|null;created_at:string;
};
type Profile={id:string;full_name:string|null;phone:string|null};
type Treatment={id:string;name:string};
type Branch={id:string;name:string;phone:string|null};

type PurchaseView=PurchaseRequest&{clientName:string;clientPhone:string|null;treatmentName:string;branchName:string};

const money=(value:number|string)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(value)||0);
const discountedAmount=(item:PurchaseRequest)=>Math.max(0,Number(item.quoted_amount)||0)*(1-(item.coupon_discount_percent||0)/100);
const sessionOptions=[1,3,5,8,10];
const durationOptions=[15,30,45,60,85];
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
 const [pendingBranchFilter,setPendingBranchFilter]=useState<'all'|'zibata'|'alamos'|'centro sur'>('all');
 const [workingId,setWorkingId]=useState<string|null>(null);
 const [configuringId,setConfiguringId]=useState<string|null>(null);
 const [draftSessions,setDraftSessions]=useState('');
 const [draftDuration,setDraftDuration]=useState('');
 const [draftInformativeNote,setDraftInformativeNote]=useState('');
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');

 const load=useCallback(async()=>{
  if(!supabase)return;
  setError('');
  try{
   const requestsResult=await supabase.from('treatment_purchase_requests')
    .select('id,user_id,treatment_id,branch_id,plan_id,status,session_count,duration_minutes,quoted_amount,uses_welcome_coupon,coupon_discount_percent,contacted_at,assigned_at,created_at')
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
 const filteredPending=useMemo(()=>pending.filter(item=>pendingBranchFilter==='all'||item.branchName.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase()===pendingBranchFilter),[pending,pendingBranchFilter]);
 const contacted=useMemo(()=>items.filter(i=>i.status==='contacted'),[items]);
 const assigned=useMemo(()=>items.filter(i=>i.status==='assigned'),[items]);
 const cancelled=useMemo(()=>items.filter(i=>i.status==='cancelled'),[items]);

 async function markContacted(id:string){
  if(!supabase)return;
  setWorkingId(id);setError('');setSuccess('');
  const {error:rpcError}=await supabase.rpc('admin_mark_purchase_request_contacted',{p_request_id:id});
  setWorkingId(null);
  if(rpcError){setError(rpcError.message);return;}
  setSuccess('Solicitud marcada como contactada.');
  await load();
 }

 async function cancelPurchase(item:PurchaseView){
  if(!supabase)return;
  const confirmed=window.confirm(item.uses_welcome_coupon?'¿Marcar esta compra como cancelada? El cupón del 10% volverá a estar disponible para el cliente.':'¿Marcar esta compra como cancelada?');
  if(!confirmed)return;
  setWorkingId(item.id);setError('');setSuccess('');
  const {error:rpcError}=await supabase.rpc('admin_cancel_purchase_request',{p_request_id:item.id});
  setWorkingId(null);
  if(rpcError){setError(rpcError.message);return;}
  if(configuringId===item.id){setConfiguringId(null);setDraftSessions('');setDraftDuration('');setDraftInformativeNote('');}
  setSuccess(item.uses_welcome_coupon?'Compra cancelada. El cupón de bienvenida del cliente volvió a quedar disponible.':'Compra cancelada.');
  await load();
 }

 function beginAssign(item:PurchaseView){
  setError('');setSuccess('');
  setConfiguringId(item.id);
  setDraftSessions(item.session_count?String(item.session_count):'');
  setDraftDuration(item.duration_minutes?String(item.duration_minutes):'');
  setDraftInformativeNote('');
 }

 async function assign(id:string){
  if(!supabase)return;
  const item=items.find(row=>row.id===id);
  if(!item)return;
  const sessions=item.session_count??(draftSessions?Number(draftSessions):null);
  const duration=item.duration_minutes??(draftDuration?Number(draftDuration):null);
  if(!sessions||!duration){setError('Define las sesiones y la duración antes de asignar el tratamiento.');return;}
  setWorkingId(id);setError('');setSuccess('');
  const {data:planId,error:rpcError}=await supabase.rpc('admin_assign_purchase_request',{p_request_id:id,p_session_count:sessions,p_duration_minutes:duration});
  if(rpcError){setWorkingId(null);setError(rpcError.message);return;}
  if(planId&&draftInformativeNote.trim()){
   const {error:noteError}=await supabase.rpc('admin_set_plan_informative_note',{p_plan_id:planId,p_informative_note:draftInformativeNote.trim()});
   if(noteError){setWorkingId(null);setError(`El tratamiento se asignó, pero no se pudo guardar la nota informativa: ${noteError.message}`);await load();return;}
  }
  setWorkingId(null);
  setConfiguringId(null);setDraftSessions('');setDraftDuration('');setDraftInformativeNote('');
  setSuccess('Tratamiento asignado correctamente. Ya aparece en Mis tratamientos y no se creó ninguna cita.');
  await load();
 }

 function RequestCard({item}:{item:PurchaseView}){
  const wa=whatsappHref(item.clientPhone,item.clientName,item.treatmentName);
  const busy=workingId===item.id;
  const hasPrice=Number(item.quoted_amount)>0;
  const discounted=discountedAmount(item);
  const active=item.status==='pending'||item.status==='contacted';
  return <article className="purchase-request-card">
   <div className="purchase-request-main">
    <div className="purchase-request-heading"><div><span className={`purchase-state purchase-${item.status}`}>{item.status==='pending'?'Pendiente de contacto':item.status==='contacted'?'Contactado':item.status==='assigned'?'Asignado':'Cancelado'}</span><h3>{item.clientName}</h3></div>{hasPrice&&(item.uses_welcome_coupon?<div className="purchase-coupon-price"><span>{money(item.quoted_amount)}</span><strong>{money(discounted)}</strong></div>:<strong>{money(item.quoted_amount)}</strong>)}</div>
    {item.uses_welcome_coupon&&<div className={`purchase-coupon-notice ${item.status==='cancelled'?'is-cancelled':''}`}><span className="purchase-coupon-icon"><Icon name="gift" size={18}/></span><div><strong>{item.status==='cancelled'?'Cupón liberado':'Canjeando cupón de bienvenida · 10%'}</strong><span>{item.status==='cancelled'?'Al cancelarse esta solicitud, el cliente vuelve a tener disponible su cupón.':hasPrice?`Precio con descuento: ${money(discounted)}.`:'Esta solicitud está canjeando el cupón del 10%. El precio se concretará por WhatsApp.'}</span></div></div>}
    <div className="purchase-request-treatment"><span className="purchase-request-icon"><Icon name="sparkles" size={18}/></span><div><strong>{item.treatmentName}</strong><span>{item.session_count?`${item.session_count} ${item.session_count===1?'sesión':'sesiones'}`:'Sesiones por confirmar'} · {item.duration_minutes?`${item.duration_minutes} min por sesión`:'Duración por confirmar'}</span></div></div>
    <div className="purchase-request-meta"><span><b>Sucursal</b>{item.branchName}</span><span><b>Teléfono</b>{item.clientPhone||'Sin teléfono'}</span><span><b>Solicitud</b>{dateTime(item.created_at)}</span>{item.contacted_at&&<span><b>Contactado</b>{dateTime(item.contacted_at)}</span>}</div>
   </div>
   <div className="purchase-request-actions">
    {active&&(wa?<a className="secondary-button" href={wa} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={16}/> Enviar WhatsApp</a>:<button className="secondary-button" type="button" disabled>Sin WhatsApp</button>)}
    {item.status==='pending'&&<button className="secondary-button" type="button" onClick={()=>void markContacted(item.id)} disabled={busy}>{busy?'Guardando…':'Marcar contactado'}</button>}
    {active&&<button className="primary-button" type="button" onClick={()=>beginAssign(item)} disabled={busy}>{busy?'Asignando…':'Asignar tratamiento'}</button>}
    {active&&<button className="purchase-cancel-button" type="button" onClick={()=>void cancelPurchase(item)} disabled={busy}>Marcar cancelada</button>}
    {item.status==='assigned'&&<span className="purchase-assigned-note"><Icon name="check" size={16}/> Tratamiento asignado</span>}
    {item.status==='cancelled'&&<span className="purchase-cancelled-note">Compra cancelada</span>}
   </div>
   {configuringId===item.id&&active&&<div className="purchase-assign-config"><div><strong>Asignar tratamiento</strong><p>{!item.session_count||!item.duration_minutes?'Completa los datos pendientes y, si quieres, agrega una nota informativa para el cliente.':'Puedes agregar una nota informativa opcional antes de crear el plan del cliente.'}</p></div>{!item.session_count&&<div className="plan-config-field"><span>Sesiones del plan</span><div className="session-choice-row">{sessionOptions.map(option=><button key={option} type="button" className={draftSessions===String(option)?'selected':''} onClick={()=>setDraftSessions(String(option))}>{option}</button>)}</div></div>}{!item.duration_minutes&&<label className="form-field">Duración por sesión<select value={draftDuration} onChange={e=>setDraftDuration(e.target.value)}><option value="">Selecciona duración</option>{durationOptions.map(option=><option key={option} value={option}>{option} minutos</option>)}</select></label>}<label className="form-field form-field-wide"><span>Nota informativa</span><textarea value={draftInformativeNote} onChange={e=>setDraftInformativeNote(e.target.value)} rows={4} placeholder="Opcional. La verá el cliente en Mi tratamiento y recepción al crear sus siguientes citas."/><small>Es independiente de las notas internas y respeta los saltos de línea.</small></label><div className="purchase-assign-config-actions"><button type="button" className="secondary-button" onClick={()=>{setConfiguringId(null);setDraftSessions('');setDraftDuration('');setDraftInformativeNote('');}}>Cancelar</button><button type="button" className="primary-button" disabled={busy||(!item.session_count&&!draftSessions)||(!item.duration_minutes&&!draftDuration)} onClick={()=>void assign(item.id)}>{busy?'Asignando…':'Confirmar y asignar'}</button></div></div>}
  </article>;
 }

 return <section className="page-stack">
  <div className="page-heading"><p className="eyebrow">Seguimiento comercial</p><h2>Compras</h2><p className="muted">Solicitudes enviadas desde la app. Contacta al cliente por WhatsApp, confirma el cupón cuando aplique y asigna el tratamiento cuando la compra quede concretada.</p></div>
  {error&&<div className="alert error-alert">{error}</div>}
  {success&&<div className="alert">{success}</div>}
  <section className="stats purchase-stats"><article><span>Pendientes de contacto</span><strong>{loading?'—':pending.length}</strong><small>Necesitan mensaje</small></article><article><span>Contactados</span><strong>{loading?'—':contacted.length}</strong><small>En seguimiento</small></article><article><span>Asignados</span><strong>{loading?'—':assigned.length}</strong><small>Compra concretada</small></article><article><span>Canceladas</span><strong>{loading?'—':cancelled.length}</strong><small>No se concretaron</small></article></section>
  {loading?<div className="fullscreen-inline"><div className="spinner"/></div>:<>
   <section className="panel-card"><div className="section-heading"><div><p className="eyebrow">Por atender</p><h3>Pendientes de enviar mensaje</h3></div><span className="purchase-count-pill">{filteredPending.length}</span></div>
   <div className="client-branch-filters" role="group" aria-label="Filtrar compras pendientes por sucursal">{([{value:'all',label:'Todos'},{value:'zibata',label:'Zibatá'},{value:'alamos',label:'Álamos'},{value:'centro sur',label:'Centro Sur'}] as const).map(option=><button key={option.value} type="button" className={pendingBranchFilter===option.value?'active':''} aria-pressed={pendingBranchFilter===option.value} onClick={()=>setPendingBranchFilter(option.value)}>{option.label}</button>)}</div>
   {filteredPending.length?<div className="purchase-request-list">{filteredPending.map(item=><RequestCard key={item.id} item={item}/>)}</div>:<div className="empty-state"><strong>{pending.length?'No hay compras pendientes en esta sucursal.':'No hay compras pendientes de contacto.'}</strong><span>{pending.length?'Selecciona otra sucursal o Todos para ver las demás solicitudes.':'Las nuevas solicitudes aparecerán aquí automáticamente.'}</span></div>}</section>
   <section className="panel-card"><div className="section-heading"><div><p className="eyebrow">Seguimiento</p><h3>Contactados</h3></div><span className="purchase-count-pill">{contacted.length}</span></div>{contacted.length?<div className="purchase-request-list">{contacted.map(item=><RequestCard key={item.id} item={item}/>)}</div>:<div className="empty-state"><strong>No hay solicitudes en seguimiento.</strong></div>}</section>
   <section className="panel-card"><div className="section-heading"><div><p className="eyebrow">Historial</p><h3>Tratamientos asignados</h3></div><span className="purchase-count-pill">{assigned.length}</span></div>{assigned.length?<div className="purchase-request-list compact-purchase-history">{assigned.map(item=><RequestCard key={item.id} item={item}/>)}</div>:<div className="empty-state"><strong>Todavía no hay compras asignadas.</strong></div>}</section>
   <section className="panel-card"><div className="section-heading"><div><p className="eyebrow">Historial</p><h3>Compras canceladas</h3></div><span className="purchase-count-pill">{cancelled.length}</span></div>{cancelled.length?<div className="purchase-request-list compact-purchase-history">{cancelled.map(item=><RequestCard key={item.id} item={item}/>)}</div>:<div className="empty-state"><strong>No hay compras canceladas.</strong></div>}</section>
  </>}
 </section>;
}
