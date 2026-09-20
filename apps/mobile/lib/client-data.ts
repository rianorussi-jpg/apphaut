import { supabase } from './supabase';
import type {ClientData, Appointment, Session, Plan} from './types';

export async function loadClientData(userId:string):Promise<ClientData>{
  if(!supabase) throw new Error('Falta configurar Supabase en Vercel.');
  const [profile,branches,treatments,categories,plans,appointments,offers,rewards,availability,balance] = await Promise.all([
    supabase.from('profiles').select('id,full_name,phone,preferred_branch_id').eq('id',userId).maybeSingle(),
    supabase.from('branches').select('id,name,slug,phone,address').eq('is_active',true).order('name'),
    supabase.from('treatments').select('id,name,category_id,description,short_description,image_url,base_price,default_duration_minutes,default_session_count,is_featured,catalog_details_pending,recommendations,contraindications').eq('is_active',true).order('name'),
    supabase.from('treatment_categories').select('id,name,slug,sort_order').eq('is_active',true).order('sort_order'),
    supabase.from('client_treatment_plans').select('id,treatment_id,client_id,default_branch_id,total_sessions,status,started_at,recommended_interval_days,created_at').eq('client_id',userId).order('created_at',{ascending:false}),
    supabase.from('appointments').select('id,plan_session_id,branch_id,starts_at,ends_at,status').order('starts_at',{ascending:false}).limit(500),
    supabase.from('promotions').select('id,title,description,image_url,treatment_id,branch_id').order('sort_order').limit(100),
    supabase.from('client_reward_movements').select('id,points,description,created_at').eq('client_id',userId).order('created_at',{ascending:false}).limit(500),
    supabase.from('treatment_branches').select('treatment_id').eq('is_active',true),
    supabase.rpc('client_reward_balance')
  ]);
  const results = [profile,branches,treatments,categories,plans,appointments,offers,rewards,availability,balance];
  const failure=results.find(r=>r.error);
  if(failure?.error)throw new Error(failure.error.message);
  const rawPlans=(plans.data??[]) as Plan[];
  let sessions:Session[]=[];
  if(rawPlans.length){
    const sr=await supabase.from('treatment_plan_sessions').select('id,plan_id,session_number,status,completed_at').in('plan_id',rawPlans.map(p=>p.id)).order('session_number');
    if(sr.error)throw new Error(sr.error.message);
    sessions=(sr.data??[]) as Session[];
  }
  return {profile:profile.data,branches:branches.data??[],treatments:treatments.data??[],categories:categories.data??[],plans:rawPlans,sessions,appointments:(appointments.data??[]) as Appointment[],promotions:offers.data??[],rewards:rewards.data??[],rewardBalance:Number(balance.data??0),availableTreatmentIds:new Set((availability.data??[]).map(row=>row.treatment_id))};
}

export const activeAppointment=(a:Appointment)=>['pending','confirmed','arrived'].includes(a.status);
export const dateLabel=(value:string, includeYear=false)=>new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'short',...(includeYear?{year:'numeric'}:{}),hour:'numeric',minute:'2-digit',timeZone:'America/Mexico_City'}).format(new Date(value));
export const justDate=(value:string)=>new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeZone:'America/Mexico_City'}).format(new Date(value));
export const treatmentFor=(d:ClientData, plan:Plan)=>d.treatments.find(t=>t.id===plan.treatment_id);
export const sessionFor=(d:ClientData, a:Appointment)=>d.sessions.find(s=>s.id===a.plan_session_id);
export const planFor=(d:ClientData,a:Appointment)=>{const session=sessionFor(d,a); return d.plans.find(p=>p.id===session?.plan_id)};
export const upcomingForPlan=(d:ClientData,plan:Plan)=>d.appointments.filter(a=>activeAppointment(a)&&new Date(a.ends_at).getTime()>=Date.now()&&d.sessions.some(s=>s.id===a.plan_session_id&&s.plan_id===plan.id)).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))[0];
export const completedCount=(d:ClientData,plan:Plan)=>d.sessions.filter(s=>s.plan_id===plan.id&&s.status==='completed').length;
export const pointsBalance=(d:ClientData)=>d.rewardBalance;
export const statusLabel=(status:string)=>({pending:'Pendiente',confirmed:'Confirmada',arrived:'Llegó',completed:'Finalizada',cancelled:'Cancelada',no_show:'No asistió',active:'En progreso',paused:'Pausado',available:'Disponible',locked:'Pendiente',scheduled:'Agendada',voided:'Anulada'} as Record<string,string>)[status]??status;
export const currency=(value:number|string)=>new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(value)||0);
export function whatsappHref(name:string, branchPhone?:string|null){
  const raw=process.env.NEXT_PUBLIC_HAUT_WHATSAPP_NUMBER || branchPhone || '';
  let phone=raw.replace(/\D/g,'');
  if(phone.length===10)phone=`52${phone}`;
  if(phone.length<10||phone.length>15)return null;
  const message=`Hola, me gustaría solicitar información sobre el tratamiento ${name} de Haut Clinical. ¿Me podrían ayudar?`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
