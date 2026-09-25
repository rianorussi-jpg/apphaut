"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {fetchBookingClients, type BookingClient} from '../lib/client-directory';

type Branch = { id: string; name: string };
type Client = BookingClient;
type Treatment = {
  id: string;
  name: string;
  default_duration_minutes: number;
  default_session_count: number;
  base_price: number | string;
  catalog_details_pending:boolean;
  durationOverride: number | null;
  priceOverride: number | null;
};
type PlanOption = {
  id:string;
  treatment_id:string;
  treatment_name:string;
  total_sessions:number;
  status:string;
  default_branch_id:string|null;
  allow_branch_change:boolean;
  completed_count:number;
  available_session_number:number|null;
  active_appointment:{id:string;starts_at:string}|null;
};

export type BookingResult = {
  appointment_id: string;
  plan_id: string;
  plan_session_id: string;
  cabin_id: string;
  cabin_name: string;
  session_number: number;
  total_sessions: number;
  starts_at: string;
  ends_at: string;
  branch_id?: string;
};

export type NewAppointmentSeed = {
  branchId: string;
  date: string;
  time: string;
  preferredCabinId?: string | null;
  preferredCabinName?: string | null;
};

const activeStatuses=['pending','confirmed','arrived'];
function dateLabel(value:string){return new Intl.DateTimeFormat('es-MX',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(value));}

export default function NewAppointmentModal({
  open,
  branches,
  seed,
  presetClientId,
  presetTreatmentId,
  presetPlanId,
  onClose,
  onCreated,
}: {
  open: boolean;
  branches: Branch[];
  seed: NewAppointmentSeed;
  presetClientId?:string|null;
  presetTreatmentId?:string|null;
  presetPlanId?:string|null;
  onClose: () => void;
  onCreated: (booking: BookingResult) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [branchId, setBranchId] = useState(seed.branchId);
  const [date, setDate] = useState(seed.date);
  const [time, setTime] = useState(seed.time);
  const [notes, setNotes] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [plans,setPlans]=useState<PlanOption[]>([]);
  const [bookingMode,setBookingMode]=useState<'plan'|'new'>('new');
  const [selectedPlanId,setSelectedPlanId]=useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingPlans,setLoadingPlans]=useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBranchId(seed.branchId);
    setDate(seed.date);
    setTime(seed.time);
    setTreatmentId(presetTreatmentId??'');
    setSelectedPlanId(presetPlanId??'');
    setBookingMode(presetPlanId?'plan':'new');
    setNotes('');
    setError('');
  }, [open, seed.branchId, seed.date, seed.time, seed.preferredCabinId, presetTreatmentId, presetPlanId]);

  useEffect(() => {
    async function loadClients() {
      if (!open || !supabase || !seed.branchId) return;
      setLoadingOptions(true);
      try {
        const rows = await fetchBookingClients(seed.branchId);
        setClients(rows);
        const preferred=presetClientId&&rows.some(item=>item.id===presetClientId)?presetClientId:null;
        setClientId((current) => preferred ?? (current && rows.some((item) => item.id === current) ? current : (rows[0]?.id ?? '')));
        if(presetClientId&&!preferred){
          setError('El cliente seleccionado no pertenece a esta sucursal. Abre la agenda de su sucursal para crear la cita.');
        }
      } catch (cause) {
        setClients([]);
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el directorio de clientes.');
      }
      setLoadingOptions(false);
    }
    void loadClients();
  }, [open,presetClientId,seed.branchId]);

  useEffect(()=>{
    async function loadPlans(){
      if(!open||!supabase||!clientId){setPlans([]);return;}
      setLoadingPlans(true);
      const {data:planRows,error:planError}=await supabase.from('client_treatment_plans')
        .select('id,treatment_id,total_sessions,status,default_branch_id,allow_branch_change,created_at')
        .eq('client_id',clientId).in('status',['active','paused']).order('created_at',{ascending:false});
      if(planError){setError(planError.message);setLoadingPlans(false);return;}
      const raw=planRows??[];
      if(!raw.length){setPlans([]);setBookingMode('new');setSelectedPlanId('');setLoadingPlans(false);return;}
      const planIds=raw.map(p=>p.id);const treatmentIds=[...new Set(raw.map(p=>p.treatment_id))];
      const [sessionResult,treatmentResult]=await Promise.all([
        supabase.from('treatment_plan_sessions').select('id,plan_id,session_number,status').in('plan_id',planIds).order('session_number'),
        supabase.from('treatments').select('id,name').in('id',treatmentIds),
      ]);
      if(sessionResult.error||treatmentResult.error){setError(sessionResult.error?.message??treatmentResult.error?.message??'No se pudieron cargar los planes.');setLoadingPlans(false);return;}
      const sessions=sessionResult.data??[];const sessionIds=sessions.map(s=>s.id);
      let activeAppointments:{id:string;plan_session_id:string;starts_at:string}[]=[];
      if(sessionIds.length){
        const ap=await supabase.from('appointments').select('id,plan_session_id,starts_at,status').in('plan_session_id',sessionIds).in('status',activeStatuses).order('starts_at');
        if(ap.error){setError(ap.error.message);setLoadingPlans(false);return;}
        activeAppointments=(ap.data??[]) as typeof activeAppointments;
      }
      const nameMap=new Map((treatmentResult.data??[]).map(t=>[t.id,t.name]));
      const built:PlanOption[]=raw.map(p=>{
        const ps=sessions.filter(s=>s.plan_id===p.id);
        const ids=new Set(ps.map(s=>s.id));
        return {
          id:p.id,treatment_id:p.treatment_id,treatment_name:nameMap.get(p.treatment_id)??'Tratamiento',total_sessions:p.total_sessions,status:p.status,
          default_branch_id:p.default_branch_id,allow_branch_change:p.allow_branch_change,
          completed_count:ps.filter(s=>s.status==='completed').length,
          available_session_number:ps.find(s=>s.status==='available')?.session_number??null,
          active_appointment:activeAppointments.find(a=>ids.has(a.plan_session_id))??null,
        };
      });
      setPlans(built);
      const canUseInCurrentBranch=(plan:PlanOption)=>!plan.default_branch_id||plan.allow_branch_change||plan.default_branch_id===seed.branchId;
      const preset=(presetPlanId&&built.find(p=>p.id===presetPlanId&&canUseInCurrentBranch(p)))||null;
      const firstBookable=built.find(p=>p.status==='active'&&!p.active_appointment&&p.available_session_number!==null&&canUseInCurrentBranch(p))??null;
      const choice=preset??firstBookable;
      if(choice){
        setBookingMode('plan');setSelectedPlanId(choice.id);setTreatmentId(choice.treatment_id);
      }else if(!presetPlanId){setBookingMode('new');setSelectedPlanId('');}
      setLoadingPlans(false);
    }
    void loadPlans();
  },[open,clientId,presetPlanId,seed.branchId]);

  useEffect(() => {
    async function loadTreatments() {
      if (!open || !supabase || !branchId) { setTreatments([]); return; }
      setLoadingOptions(true);
      const { data: branchRows, error: branchError } = await supabase.from('treatment_branches')
        .select('treatment_id, price_override, duration_override_minutes').eq('branch_id', branchId).eq('is_active', true);
      if (branchError) { setError(branchError.message); setLoadingOptions(false); return; }
      const ids = (branchRows ?? []).map((row) => row.treatment_id);
      if (!ids.length) { setTreatments([]); setLoadingOptions(false); return; }
      const { data: treatmentRows, error: treatmentError } = await supabase.from('treatments')
        .select('id, name, default_duration_minutes, default_session_count, base_price, catalog_details_pending').in('id', ids)
        .eq('is_active', true).order('name');
      if (treatmentError) { setError(treatmentError.message); setLoadingOptions(false); return; }
      const branchMap = new Map((branchRows ?? []).map((row) => [row.treatment_id, row]));
      const merged: Treatment[] = (treatmentRows ?? []).map((row) => {const branch=branchMap.get(row.id);return {...row,durationOverride:branch?.duration_override_minutes??null,priceOverride:branch?.price_override==null?null:Number(branch.price_override)};});
      setTreatments(merged);
      if(bookingMode==='new'){
        const activeTreatmentIds=new Set(plans.map(p=>p.treatment_id));
        const available=merged.filter(t=>!activeTreatmentIds.has(t.id));
        setTreatmentId(current=>current&&available.some(item=>item.id===current)?current:(presetTreatmentId&&available.some(item=>item.id===presetTreatmentId)?presetTreatmentId:(available[0]?.id??'')));
      }
      setLoadingOptions(false);
    }
    void loadTreatments();
  }, [open, branchId, bookingMode, plans, presetTreatmentId]);

  const activeTreatmentIds=useMemo(()=>new Set(plans.map(p=>p.treatment_id)),[plans]);
  const newTreatments=useMemo(()=>treatments.filter(t=>!activeTreatmentIds.has(t.id)),[treatments,activeTreatmentIds]);
  const selectedPlan=plans.find(p=>p.id===selectedPlanId)??null;
  const selectedTreatment = useMemo(() => treatments.find((item) => item.id === treatmentId), [treatments, treatmentId]);
  const selectedBranch=branches.find(branch=>branch.id===branchId)??null;
  const preferredCabinApplies = branchId === seed.branchId && Boolean(seed.preferredCabinId);

  function choosePlan(plan:PlanOption){
    const wrongFixedBranch=Boolean(plan.default_branch_id&&!plan.allow_branch_change&&plan.default_branch_id!==branchId);
    if(plan.status!=='active'||plan.active_appointment||plan.available_session_number===null||wrongFixedBranch)return;
    setBookingMode('plan');setSelectedPlanId(plan.id);setTreatmentId(plan.treatment_id);setError('');
  }
  function chooseNew(){
    setBookingMode('new');setSelectedPlanId('');setError('');
    const first=newTreatments[0];setTreatmentId(first?.id??'');
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!supabase) { setError('Supabase no está configurado.'); return; }
    if (!clientId || !treatmentId || !branchId || !date || !time) { setError('Completa cliente, tratamiento, fecha y hora.'); return; }
    if(bookingMode==='plan'&&!selectedPlanId){setError('Selecciona el tratamiento activo que deseas continuar.');return;}
    setSaving(true);
    const { data, error: bookingError } = await supabase.rpc('admin_create_appointment', {
      p_client_id: clientId,p_treatment_id: treatmentId,p_branch_id: branchId,p_date: date,p_time: `${time}:00`,
      p_preferred_cabin_id: preferredCabinApplies ? seed.preferredCabinId ?? null : null,p_internal_notes: notes || null,
    });
    setSaving(false);
    if (bookingError) { setError(bookingError.message.replace(/^.*?: /, '')); return; }
    const booking = Array.isArray(data) ? data[0] : data;
    if (!booking) { setError('La cita no pudo crearse.'); return; }
    onCreated({...booking,branch_id:branchId} as BookingResult);
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="new-appointment-title">
        <div className="modal-head"><div><p className="eyebrow">Agenda administrativa</p><h2 id="new-appointment-title">Nueva cita</h2></div><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">×</button></div>
        <form className="booking-form" onSubmit={submit}>
          <div className="booking-form-grid">
            <div className="selected-plan-summary form-field-wide"><span>Sucursal</span><strong>{selectedBranch?.name??'Sucursal seleccionada'}</strong></div>

            <label className="form-field form-field-wide"><span>Cliente</span><select value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={loadingOptions || !clients.length}>{!clients.length&&<option value="">No hay clientes de esta sucursal</option>}{clients.map((client)=><option key={client.id} value={client.id}>{client.full_name}{client.phone?` · ${client.phone}`:client.email?` · ${client.email}`:''}</option>)}</select>{!clients.length&&!loadingOptions&&<small>Solo aparecen clientes vinculados a {selectedBranch?.name??'esta sucursal'}.</small>}</label>

            <div className="form-field form-field-wide"><span>¿Qué deseas agendar?</span>
              <div className="booking-path-list">
                {loadingPlans&&<div className="booking-path-note">Cargando tratamientos iniciados…</div>}
                {!loadingPlans&&plans.map(plan=>{
                  const fixedElsewhere=Boolean(plan.default_branch_id&&!plan.allow_branch_change&&plan.default_branch_id!==branchId);
                  const selectable=plan.status==='active'&&!plan.active_appointment&&plan.available_session_number!==null&&!fixedElsewhere;
                  const branch=branches.find(b=>b.id===plan.default_branch_id)?.name;
                  return <button type="button" key={plan.id} disabled={!selectable} onClick={()=>choosePlan(plan)} className={`booking-path-card ${bookingMode==='plan'&&selectedPlanId===plan.id?'selected':''} ${!selectable?'disabled':''}`}>
                    <span className="booking-path-kicker">TRATAMIENTO INICIADO</span><strong>{plan.treatment_name}</strong>
                    <small>{plan.completed_count} de {plan.total_sessions} sesiones completadas{branch?` · Haut ${branch}`:''}</small>
                    {plan.active_appointment?<em>Próxima cita: {dateLabel(plan.active_appointment.starts_at)}</em>:fixedElsewhere?<em>Este plan pertenece a Haut {branch??'otra sucursal'}</em>:plan.status==='paused'?<em>Plan pausado</em>:plan.available_session_number!==null?<em>Agendar sesión {plan.available_session_number} de {plan.total_sessions}</em>:<em>La siguiente sesión aún no está habilitada</em>}
                  </button>;
                })}
                <button type="button" onClick={chooseNew} className={`booking-path-card booking-path-new ${bookingMode==='new'?'selected':''}`}><span className="booking-path-kicker">NUEVO TRATAMIENTO</span><strong>Iniciar un tratamiento diferente</strong><small>Puede tener otros tratamientos activos al mismo tiempo.</small></button>
              </div>
            </div>

            {bookingMode==='plan'&&selectedPlan?<div className="selected-plan-summary form-field-wide"><span>Continuar tratamiento</span><strong>{selectedPlan.treatment_name}</strong><small>Sesión {selectedPlan.available_session_number} de {selectedPlan.total_sessions}</small></div>:
            <label className="form-field form-field-wide"><span>Nuevo tratamiento</span><select value={treatmentId} onChange={(event) => setTreatmentId(event.target.value)} disabled={loadingOptions || !newTreatments.length}>{!newTreatments.length&&<option value="">No hay otro tratamiento disponible</option>}{newTreatments.map((treatment)=><option key={treatment.id} value={treatment.id}>{treatment.name}</option>)}</select>{selectedTreatment&&<small>{selectedTreatment.default_session_count>1?`${selectedTreatment.default_session_count} sesiones · `:''}{selectedTreatment.durationOverride??selectedTreatment.default_duration_minutes} min{selectedTreatment.catalog_details_pending?' · ficha de catálogo pendiente':''}</small>}</label>}

            <label className="form-field"><span>Fecha</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
            <label className="form-field"><span>Hora</span><input type="time" step="1800" value={time} onChange={(event) => setTime(event.target.value)} required /></label>
            {preferredCabinApplies&&<div className="preferred-cabin form-field-wide"><span>Cabina</span><strong>{seed.preferredCabinName||'Cabina seleccionada'}</strong></div>}
            <label className="form-field form-field-wide"><span>Notas internas</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Opcional" /></label>
          </div>
          {error&&<div className="alert error-alert">{error}</div>}
          <div className="booking-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancelar</button><button type="submit" className="primary-button inline-button" disabled={saving||loadingOptions||loadingPlans||!clients.length||!treatmentId}>{saving?'Creando cita…':'Confirmar cita'}</button></div>
        </form>
      </section>
    </div>
  );
}
