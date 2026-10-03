'use client';

import {FormEvent,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Branch,Profile} from '@/lib/types';

const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export function ProfileSetupScreen({userId,profile,branches,onComplete}:{userId:string;profile:Profile|null;branches:Branch[];onComplete:()=>Promise<void>}){
  const now=new Date();
  const currentYear=now.getFullYear();
  const [name,setName]=useState(profile?.full_name??'');
  const [phone,setPhone]=useState(profile?.phone??'');
  const [branchId,setBranchId]=useState(profile?.preferred_branch_id??'');
  const existing=profile?.birth_date?.split('-')??[];
  const [year,setYear]=useState(existing[0]??'');
  const [month,setMonth]=useState(existing[1]?String(Number(existing[1])):'');
  const [day,setDay]=useState(existing[2]?String(Number(existing[2])):'');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);

  const years=Array.from({length:101},(_,index)=>String(currentYear-index));
  const daysInMonth=year&&month?new Date(Number(year),Number(month),0).getDate():31;
  const days=Array.from({length:daysInMonth},(_,index)=>String(index+1));

  async function submit(e:FormEvent){
    e.preventDefault();setError('');
    if(!supabase){setError('Supabase no está configurado.');return;}
    if(name.trim().length<2){setError('Escribe tu nombre completo.');return;}
    if(phone.replace(/\D/g,'').length<10){setError('Escribe un número de teléfono válido.');return;}
    if(!day||!month||!year){setError('Selecciona tu fecha de nacimiento completa.');return;}
    if(!branchId){setError('Selecciona tu sucursal.');return;}
    const birthDate=`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    const parsed=new Date(`${birthDate}T12:00:00`);
    if(Number.isNaN(parsed.getTime())||parsed>now){setError('Revisa tu fecha de nacimiento.');return;}
    setSaving(true);
    try{
      const {error:e}=await supabase.from('profiles').update({
        full_name:name.trim(),
        phone:phone.trim(),
        birth_date:birthDate,
        preferred_branch_id:branchId
      }).eq('id',userId);
      if(e)throw e;
      await onComplete();
    }catch(e){setError(e instanceof Error?e.message:'No pudimos guardar tus datos.');}
    finally{setSaving(false);}
  }

  return <main className="auth-wrap"><section className="auth-card onboarding-card">
    <div className="auth-mark">H</div>
    <p className="brand-kicker">BIENVENIDO A HAUT</p>
    <h1>Cuéntanos un poco de ti</h1>
    <p className="subtle auth-copy">Solo necesitamos estos datos la primera vez para preparar tu experiencia y relacionarte con tu sucursal.</p>
    <form onSubmit={submit} className="auth-form onboarding-form">
      <label>Nombre completo<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre completo"/></label>
      <label>Número de teléfono<input type="tel" required autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="442 123 4567"/></label>
      <fieldset className="birth-fieldset">
        <legend>Fecha de nacimiento</legend>
        <div className="birth-selects">
          <label><span>Día</span><select required value={day} onChange={e=>setDay(e.target.value)}><option value="">Día</option>{days.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
          <label><span>Mes</span><select required value={month} onChange={e=>{setMonth(e.target.value);setDay('');}}><option value="">Mes</option>{MONTHS.map((label,index)=><option key={label} value={String(index+1)}>{label}</option>)}</select></label>
          <label><span>Año</span><select required value={year} onChange={e=>{setYear(e.target.value);setDay('');}}><option value="">Año</option>{years.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
        </div>
      </fieldset>
      <label>Sucursal<select required value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Selecciona tu sucursal</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
      {!branches.length&&<p className="form-error">No hay sucursales disponibles. Comunícate con HAUT.</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}
      <button type="submit" disabled={saving||!branches.length} className="primary-button">{saving?'Guardando…':'Entrar a HAUT'}</button>
    </form>
    <p className="small-print">Podrás actualizar tus datos más adelante desde tu perfil.</p>
  </section></main>;
}
