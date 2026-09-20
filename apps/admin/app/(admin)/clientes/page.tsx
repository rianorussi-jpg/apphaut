'use client';
import {FormEvent,useCallback,useEffect,useState} from 'react';
import {supabase} from '../../../lib/supabase';
type Client={id:string;full_name:string;phone:string|null;email:string|null};
type Treatment={id:string;name:string;default_session_count:number};
type Branch={id:string;name:string};
type Plan={id:string;client_id:string;status:string;treatment_id:string;total_sessions:number};
export default function ClientesPage(){
 const [clients,setClients]=useState<Client[]>([]);const [branches,setBranches]=useState<Branch[]>([]);const[treatments,setTreatments]=useState<Treatment[]>([]);const[plans,setPlans]=useState<Plan[]>([]);
 const [clientId,setClientId]=useState('');const [branchId,setBranchId]=useState('');const[treatmentId,setTreatmentId]=useState('');const [count,setCount]=useState('');const[rewardPoints,setRewardPoints]=useState('');const[rewardReason,setRewardReason]=useState('');
 const[error,setError]=useState('');const[success,setSuccess]=useState('');const[saving,setSaving]=useState(false);const[loading,setLoading]=useState(true);
 const reload=useCallback(async()=>{if(!supabase){setError('Falta configurar Supabase.');setLoading(false);return;}try{const [c,b,t,p]=await Promise.all([
  supabase.rpc('admin_booking_clients'),supabase.from('branches').select('id,name').eq('is_active',true).order('name'),supabase.from('treatments').select('id,name,default_session_count').eq('is_active',true).order('name'),supabase.from('client_treatment_plans').select('id,client_id,status,treatment_id,total_sessions')]);
  for(const r of [c,b,t,p])if(r.error)throw r.error;
  setClients(c.data??[]);setBranches(b.data??[]);setTreatments(t.data??[]);setPlans(p.data??[]);
 }catch(e){setError(e instanceof Error?e.message:'No pudimos cargar clientes.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void reload();},[reload]);
 const selected=clients.find(c=>c.id===clientId);const selectedTreatment=treatments.find(t=>t.id===treatmentId);
 async function assign(e:FormEvent){e.preventDefault();setError('');setSuccess('');if(!supabase||!clientId||!branchId||!treatmentId)return;setSaving(true);const total=count.trim()?Number(count):null;
 const {error:err}=await supabase.rpc('admin_assign_treatment_plan',{p_client_id:clientId,p_branch_id:branchId,p_treatment_id:treatmentId,p_total_sessions:total});setSaving(false);
 if(err){setError(err.message);return;}setSuccess('Tratamiento asignado. Ya aparece en la app del cliente.');setCount('');await reload();}
 async function addRewards(e:FormEvent){e.preventDefault();setError('');setSuccess('');if(!supabase||!clientId)return;setSaving(true);const{error:err}=await supabase.rpc('admin_add_reward_points',{p_client_id:clientId,p_points:Number(rewardPoints),p_description:rewardReason.trim()});setSaving(false);if(err){setError(err.message);return;}setSuccess('Movimiento de rewards registrado.');setRewardPoints('');setRewardReason('');}
 return <section className="page-stack"><div className="page-heading"><p className="eyebrow">Directorio</p><h2>Clientes</h2><p className="muted">Selecciona un cliente registrado y asígnale un plan sin necesidad de crear una cita.</p></div>
 {error&&<div className="alert error-alert" role="alert">{error}</div>}{success&&<div className="alert" role="status">{success}</div>}
 {loading?<div className="fullscreen-inline"><div className="spinner"/></div>:<div className="card-grid three-cols">{clients.map(c=><button type="button" onClick={()=>{setClientId(c.id);setSuccess('');setError('');}} className="panel-card" key={c.id} style={{textAlign:'left',cursor:'pointer',borderColor:clientId===c.id?'var(--gold-800)':undefined}}><h3>{c.full_name}</h3><p>{c.phone||'Sin teléfono'}</p><p>{c.email||''}</p><p className="muted">Planes: {plans.filter(p=>p.client_id===c.id).length} · Activos: {plans.filter(p=>p.client_id===c.id&&p.status==='active').length}</p></button>)}</div>}
 {!loading&&!clients.length&&<div className="empty-state"><strong>Todavía no hay clientes registrados.</strong><span>Cuando se registren en la app aparecerán aquí.</span></div>}
 {selected&&<div className="panel-card"><p className="eyebrow">Cliente seleccionado</p><h2>{selected.full_name}</h2>
  <h3>Planes asignados</h3>{plans.filter(p=>p.client_id===selected.id).length?plans.filter(p=>p.client_id===selected.id).map(p=><p key={p.id}>{treatments.find(t=>t.id===p.treatment_id)?.name||'Tratamiento'} · {p.total_sessions} sesiones · {p.status}</p>):<p className="muted">Sin tratamientos asignados.</p>}
  <form onSubmit={assign} style={{display:'grid',gap:12,maxWidth:520,marginTop:20}}><h3>Asignar tratamiento</h3><label>Sucursal<br/><select required value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Selecciona sucursal</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
   <label>Tratamiento<br/><select required value={treatmentId} onChange={e=>{setTreatmentId(e.target.value);setCount('');}}><option value="">Selecciona tratamiento</option>{treatments.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
   <label>Sesiones para este cliente (opcional; predeterminado {selectedTreatment?.default_session_count??'—'})<br/><input type="number" min="1" max="200" value={count} onChange={e=>setCount(e.target.value)} placeholder={String(selectedTreatment?.default_session_count??'')}/></label><button type="submit" disabled={saving}>Asignar plan</button><small className="muted">La siguiente cita se agrega desde Agenda. Si la asignación falla, verifica que el tratamiento esté habilitado en esa sucursal.</small></form>
  <form onSubmit={addRewards} style={{display:'grid',gap:12,maxWidth:520,marginTop:28}}><h3>Rewards</h3><label>Puntos a agregar (negativo para descontar)<br/><input type="number" min="-100000" max="100000" required value={rewardPoints} onChange={e=>setRewardPoints(e.target.value)}/></label><label>Motivo<br/><input required minLength={3} value={rewardReason} onChange={e=>setRewardReason(e.target.value)} placeholder="Compra, recompensa, ajuste…"/></label><button disabled={saving} type="submit">Registrar movimiento</button></form>
 </div>}
 </section>;
}
