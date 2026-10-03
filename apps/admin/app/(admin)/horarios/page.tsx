"use client";

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabase';

type Branch={id:string;name:string};
type Hours={id:string;branch_id:string;weekday:number;start_time:string;end_time:string};
const days=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

export default function HorariosPage(){
 const[branches,setBranches]=useState<Branch[]>([]),[hours,setHours]=useState<Hours[]>([]);const[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{(async()=>{if(!supabase)return;try{const[b,h]=await Promise.all([supabase.from('branches').select('id,name').eq('is_active',true).order('name'),supabase.from('business_hours').select('id,branch_id,weekday,start_time,end_time').order('weekday').order('start_time')]);if(b.error)throw b.error;if(h.error)throw h.error;setBranches((b.data??[])as Branch[]);setHours((h.data??[])as Hours[])}catch(e){setError(e instanceof Error?e.message:'No se pudieron cargar los horarios.')}finally{setLoading(false)}})()},[]);
 const configuredDays=useMemo(()=>new Set(hours.map(row=>`${row.branch_id}:${row.weekday}`)).size,[hours]);
 return <section className="page-stack"><div className="page-heading"><p className="eyebrow">Operación por sucursal</p><h2>Horarios</h2><p className="muted">Consulta los horarios semanales que utiliza la agenda para organizar la operación de HAUT.</p></div>{error&&<div className="alert error-alert">{error}</div>}{loading?<div className="fullscreen-inline"><div className="spinner"/></div>:<><section className="stats"><article><span>Sucursales activas</span><strong>{branches.length}</strong><small>Operación disponible</small></article><article><span>Días configurados</span><strong>{configuredDays}</strong><small>Entre todas las sucursales</small></article><article><span>Rangos de horario</span><strong>{hours.length}</strong><small>Tramos semanales registrados</small></article><article><span>Vista</span><strong>7</strong><small>Días por semana</small></article></section><section className="panel-card"><div className="section-heading"><div><p className="eyebrow">SEMANA OPERATIVA</p><h3>Horario por sucursal</h3></div></div>{branches.length?branches.map(b=><div className="hours-branch" key={b.id}><strong>{b.name}</strong><div className="hours-grid">{days.map((day,index)=>{const rows=hours.filter(h=>h.branch_id===b.id&&h.weekday===index);return <div key={day}><span>{day}</span><b>{rows.length?rows.map(r=>`${r.start_time.slice(0,5)}–${r.end_time.slice(0,5)}`).join(', '):'Sin horario'}</b></div>})}</div></div>):<div className="empty-state"><strong>Sin sucursales activas.</strong></div>}</section></>}</section>
}
