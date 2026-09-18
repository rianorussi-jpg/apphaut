"use client";

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import NewAppointmentModal, { type NewAppointmentSeed } from '../../../components/NewAppointmentModal';
import { getAppointmentViews, type AppointmentView } from '../../../lib/admin-data';
import { supabase } from '../../../lib/supabase';

type Branch = { id: string; name: string };
type Cabin = { id: string; name: string; sort_order: number };
type ViewMode = 'day' | 'week';

const SLOT_HEIGHT = 48;
function localDateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`; }
function inputDate(date: Date) { return localDateKey(date); }
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function startOfDay(date: Date) { const d = new Date(date); d.setHours(0,0,0,0); return d; }
function startOfWeek(date: Date) { const d=startOfDay(date); const day=d.getDay(); const diff=day===0?-6:1-day; d.setDate(d.getDate()+diff); return d; }
function timeToMinutes(value: string) { const [h,m]=value.split(':').map(Number); return h*60+m; }
function minutesLabel(minutes: number) { const h=Math.floor(minutes/60); const m=minutes%60; return new Date(2000,0,1,h,m).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}); }
function minutesInput(minutes: number) { return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`; }

export default function AgendaPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState('');
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [appointments, setAppointments] = useState<AppointmentView[]>([]);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [view, setView] = useState<ViewMode>('day');
  const [startMinutes, setStartMinutes] = useState(9*60);
  const [endMinutes, setEndMinutes] = useState(20*60);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingSeed, setBookingSeed] = useState<NewAppointmentSeed>({ branchId: '', date: inputDate(new Date()), time: '09:00' });

  useEffect(() => {
    async function loadBranches() {
      if (!supabase) return;
      const { data, error } = await supabase.from('branches').select('id, name').eq('is_active', true).order('name');
      if (error) { setError(error.message); setLoading(false); return; }
      const rows=(data ?? []) as Branch[];
      setBranches(rows);
      if (rows.length) setBranchId((current) => current || rows[0].id);
      else setLoading(false);
    }
    loadBranches();
  }, []);

  useEffect(() => {
    async function loadAgenda() {
      if (!supabase || !branchId) return;
      setLoading(true); setError('');
      try {
        const base = startOfDay(selectedDate);
        const from = view === 'week' ? startOfWeek(base) : base;
        const to = view === 'week' ? addDays(from, 7) : addDays(from, 1);
        const weekday = base.getDay();
        const [cabinsResult, appointmentsResult, hoursResult] = await Promise.all([
          supabase.from('cabins').select('id, name, sort_order').eq('branch_id', branchId).eq('is_active', true).order('sort_order').order('name'),
          getAppointmentViews({ branchId, from: from.toISOString(), to: to.toISOString(), limit: 400 }),
          supabase.from('business_hours').select('start_time, end_time').eq('branch_id', branchId).eq('weekday', weekday).order('start_time'),
        ]);
        if (cabinsResult.error) throw cabinsResult.error;
        if (hoursResult.error) throw hoursResult.error;
        setCabins((cabinsResult.data ?? []) as Cabin[]);
        setAppointments(appointmentsResult);
        if (hoursResult.data?.length) {
          const starts=hoursResult.data.map((h) => timeToMinutes(h.start_time));
          const ends=hoursResult.data.map((h) => timeToMinutes(h.end_time));
          setStartMinutes(Math.min(...starts)); setEndMinutes(Math.max(...ends));
        } else { setStartMinutes(9*60); setEndMinutes(20*60); }
      } catch (err) { setError(err instanceof Error ? err.message : 'No se pudo cargar la agenda.'); }
      finally { setLoading(false); }
    }
    loadAgenda();
  }, [branchId, selectedDate, view, refreshKey]);

  const slots = useMemo(() => {
    const result:number[]=[]; for(let m=startMinutes;m<=endMinutes;m+=30) result.push(m); return result;
  }, [startMinutes,endMinutes]);
  const bodyHeight = Math.max(1, slots.length - 1) * SLOT_HEIGHT;
  const weekStart = startOfWeek(selectedDate);
  const weekDays = Array.from({length:7},(_,i)=>addDays(weekStart,i));

  function move(direction: number) { setSelectedDate((date) => addDays(date, direction * (view === 'week' ? 7 : 1))); }

  function openNewAppointment(seed?: Partial<NewAppointmentSeed>) {
    const next: NewAppointmentSeed = {
      branchId,
      date: inputDate(selectedDate),
      time: minutesInput(startMinutes),
      preferredCabinId: null,
      preferredCabinName: null,
      ...seed,
    };
    setBookingSeed(next);
    setSuccess('');
    setBookingOpen(true);
  }

  return (
    <section className="page-stack">
      <div className="toolbar-card agenda-toolbar">
        <div className="field-group"><label>Sucursal</label><select value={branchId} onChange={(e)=>setBranchId(e.target.value)}><option value="">Selecciona sucursal</option>{branches.map((branch)=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></div>
        <div className="date-controls"><button className="icon-button" onClick={()=>move(-1)}>‹</button><input type="date" value={inputDate(selectedDate)} onChange={(e)=>{const [y,m,d]=e.target.value.split('-').map(Number); setSelectedDate(new Date(y,m-1,d));}}/><button className="icon-button" onClick={()=>move(1)}>›</button><button className="secondary-button" onClick={()=>setSelectedDate(new Date())}>Hoy</button></div>
        <div className="segmented"><button className={view==='day'?'active':''} onClick={()=>setView('day')}>Día</button><button className={view==='week'?'active':''} onClick={()=>setView('week')}>Semana</button></div>
        <button className="primary-button inline-button" disabled={!branchId} onClick={()=>openNewAppointment()}>+ Nueva cita</button>
      </div>

      {error && <div className="alert error-alert">{error}</div>}
      {success && <div className="alert success-alert">{success}</div>}
      {!branches.length && !loading && <div className="empty-state large-empty"><strong>Todavía no hay sucursales en Supabase.</strong><span>Crea las sucursales reales de Haut para comenzar a usar la agenda.</span></div>}

      {branchId && view === 'day' && (
        <section className="calendar-card">
          <div className="calendar-title"><div><p className="eyebrow">Vista día</p><h2>{selectedDate.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h2></div><span>{cabins.length} {cabins.length===1?'cabina':'cabinas'} · clic en un espacio vacío para crear cita</span></div>
          {loading ? <div className="fullscreen-inline"><div className="spinner"/><span>Cargando agenda…</span></div> : cabins.length ? (
            <div className="calendar-scroll">
              <div className="calendar-header" style={{gridTemplateColumns:`82px repeat(${cabins.length}, minmax(190px, 1fr))`}}><div/><>{cabins.map((c)=><div key={c.id} className="cabin-header">{c.name}</div>)}</></div>
              <div className="calendar-body" style={{gridTemplateColumns:`82px repeat(${cabins.length}, minmax(190px, 1fr))`}}>
                <div className="time-rail" style={{height:bodyHeight}}>{slots.slice(0,-1).map((m,i)=><div className="time-slot" style={{top:i*SLOT_HEIGHT}} key={m}>{minutesLabel(m)}</div>)}</div>
                {cabins.map((cabin)=><div
                  className="cabin-track cabin-track-clickable"
                  key={cabin.id}
                  style={{height:bodyHeight, backgroundSize:`100% ${SLOT_HEIGHT}px`}}
                  title={`Crear cita en ${cabin.name}`}
                  onClick={(event)=>{
                    const rect=event.currentTarget.getBoundingClientRect();
                    const y=Math.max(0, Math.min(bodyHeight-1, event.clientY-rect.top));
                    const slotIndex=Math.floor(y/SLOT_HEIGHT);
                    const minutes=Math.min(endMinutes-30, startMinutes+slotIndex*30);
                    openNewAppointment({
                      branchId,
                      date: inputDate(selectedDate),
                      time: minutesInput(minutes),
                      preferredCabinId: cabin.id,
                      preferredCabinName: cabin.name,
                    });
                  }}
                >
                  {appointments.filter((a)=>a.cabinId===cabin.id).map((appointment)=>{
                    const start=new Date(appointment.startsAt); const end=new Date(appointment.endsAt);
                    const startM=start.getHours()*60+start.getMinutes(); const endM=end.getHours()*60+end.getMinutes();
                    const top=Math.max(0,((startM-startMinutes)/30)*SLOT_HEIGHT); const height=Math.max(38,((endM-startM)/30)*SLOT_HEIGHT-4);
                    return <Link onClick={(event)=>event.stopPropagation()} href={`/citas/${appointment.id}`} className={`calendar-appointment status-bg-${appointment.status}`} style={{top,height}} key={appointment.id}><strong>{start.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})} · {appointment.clientName}</strong><span>{appointment.treatmentName}</span>{appointment.totalSessions && appointment.totalSessions>1 && <small>Sesión {appointment.sessionNumber} de {appointment.totalSessions}</small>}</Link>;
                  })}
                </div>)}
              </div>
            </div>
          ) : <div className="empty-state large-empty"><strong>Esta sucursal no tiene cabinas activas.</strong><span>Las columnas se crearán automáticamente cuando agregues cabinas.</span></div>}
        </section>
      )}

      {branchId && view === 'week' && (
        <section className="calendar-card">
          <div className="calendar-title"><div><p className="eyebrow">Vista semana</p><h2>{weekStart.toLocaleDateString('es-MX',{day:'numeric',month:'short'})} – {addDays(weekStart,6).toLocaleDateString('es-MX',{day:'numeric',month:'short',year:'numeric'})}</h2></div><span>{appointments.length} citas</span></div>
          {loading ? <div className="fullscreen-inline"><div className="spinner"/><span>Cargando semana…</span></div> : <div className="week-grid">{weekDays.map((day)=>{ const key=localDateKey(day); const list=appointments.filter((a)=>localDateKey(new Date(a.startsAt))===key); return <div className="week-day" key={key}><div className="week-day-header"><strong>{day.toLocaleDateString('es-MX',{weekday:'short'})}</strong><span>{day.getDate()}</span></div>{list.length?list.map((a)=><Link className="week-appointment" href={`/citas/${a.id}`} key={a.id}><b>{new Date(a.startsAt).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</b><span>{a.clientName}</span><small>{a.treatmentName} · {a.cabinName}</small></Link>):<span className="week-empty">Sin citas</span>}</div>})}</div>}
        </section>
      )}

      <NewAppointmentModal
        open={bookingOpen}
        branches={branches}
        seed={bookingSeed}
        onClose={()=>setBookingOpen(false)}
        onCreated={(booking)=>{
          setBookingOpen(false);
          setSelectedDate(new Date(booking.starts_at));
          setView('day');
          setSuccess(`Cita creada correctamente · ${booking.cabin_name} · sesión ${booking.session_number} de ${booking.total_sessions}.`);
          setRefreshKey((value)=>value+1);
        }}
      />
    </section>
  );
}
