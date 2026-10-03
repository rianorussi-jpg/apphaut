"use client";

import {FormEvent,useEffect,useMemo,useState} from 'react';
import {supabase} from '../lib/supabase';

type Branch={id:string;name:string};
export type CreatedClient={id:string;full_name:string;email:string;phone:string;branch_id:string};

const MONTHS=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

export default function NewClientModal({open,branches,onClose,onCreated}:{open:boolean;branches:Branch[];onClose:()=>void;onCreated:(client:CreatedClient)=>void|Promise<void>}){
  const currentYear=new Date().getFullYear();
  const [email,setEmail]=useState('');
  const [name,setName]=useState('');
  const [phone,setPhone]=useState('');
  const [branchId,setBranchId]=useState('');
  const [day,setDay]=useState('');
  const [month,setMonth]=useState('');
  const [year,setYear]=useState('');
  const [error,setError]=useState('');
  const [saving,setSaving]=useState(false);

  useEffect(()=>{
    if(!open)return;
    setEmail('');setName('');setPhone('');setBranchId('');setDay('');setMonth('');setYear('');setError('');setSaving(false);
  },[open]);

  const years=useMemo(()=>Array.from({length:101},(_,index)=>String(currentYear-index)),[currentYear]);
  const daysInMonth=year&&month?new Date(Number(year),Number(month),0).getDate():31;
  const days=useMemo(()=>Array.from({length:daysInMonth},(_,index)=>String(index+1)),[daysInMonth]);

  async function submit(e:FormEvent){
    e.preventDefault();setError('');
    if(!supabase){setError('Supabase no está configurado.');return;}
    const cleanEmail=email.trim().toLowerCase();
    const cleanName=name.trim();
    const cleanPhone=phone.trim();
    if(!/^\S+@\S+\.\S+$/.test(cleanEmail)){setError('Escribe un correo válido.');return;}
    if(cleanName.length<2){setError('Escribe el nombre completo.');return;}
    if(cleanPhone.replace(/\D/g,'').length<10){setError('Escribe un número de teléfono válido.');return;}
    if(!day||!month||!year){setError('Selecciona la fecha de nacimiento completa.');return;}
    if(!branchId){setError('Selecciona la sucursal del cliente.');return;}
    const birthDate=`${year}-${month.padStart(2,'0')}-${day.padStart(2,'0')}`;
    const parsed=new Date(`${birthDate}T12:00:00`);
    if(Number.isNaN(parsed.getTime())||parsed>new Date()){setError('Revisa la fecha de nacimiento.');return;}

    setSaving(true);
    try{
      const {data,error:invokeError}=await supabase.functions.invoke('admin-create-client',{body:{
        email:cleanEmail,
        full_name:cleanName,
        phone:cleanPhone,
        birth_date:birthDate,
        branch_id:branchId,
      }});
      if(invokeError){
        let message=invokeError.message;
        const context=(invokeError as {context?:Response}).context;
        if(context&&typeof context.json==='function'){
          try{const payload=await context.json() as {error?:string};if(payload?.error)message=payload.error;}catch{}
        }
        throw new Error(message);
      }
      if(!data?.ok||!data?.client?.id)throw new Error(data?.error||'No se pudo crear el cliente.');
      await onCreated(data.client as CreatedClient);
    }catch(e){setError(e instanceof Error?e.message:'No se pudo crear el cliente.');}
    finally{setSaving(false);}
  }

  if(!open)return null;

  return <div className="modal-backdrop" role="presentation" onMouseDown={event=>event.target===event.currentTarget&&onClose()}>
    <section className="booking-modal client-create-modal" role="dialog" aria-modal="true" aria-labelledby="new-client-title">
      <div className="modal-head"><div><p className="eyebrow">Directorio</p><h2 id="new-client-title">Nuevo cliente</h2><p className="muted client-modal-intro">Captura sus datos completos para que pueda entrar a HAUT sin volver a llenar su perfil.</p></div><button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">×</button></div>
      <form className="booking-form" onSubmit={submit}>
        <div className="booking-form-grid">
          <label className="form-field"><span>Nombre completo</span><input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre y apellidos"/></label>
          <label className="form-field"><span>Correo</span><input required type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="cliente@correo.com"/></label>
          <label className="form-field"><span>Número de teléfono</span><input required type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="442 123 4567"/></label>
          <label className="form-field"><span>Sucursal</span><select required value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Selecciona sucursal</option>{branches.map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
          <fieldset className="form-field form-field-wide admin-birth-fieldset"><span>Fecha de nacimiento</span><div className="admin-birth-selects">
            <label><small>Día</small><select required value={day} onChange={e=>setDay(e.target.value)}><option value="">Día</option>{days.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
            <label><small>Mes</small><select required value={month} onChange={e=>{setMonth(e.target.value);setDay('');}}><option value="">Mes</option>{MONTHS.map((label,index)=><option key={label} value={String(index+1)}>{label}</option>)}</select></label>
            <label><small>Año</small><select required value={year} onChange={e=>{setYear(e.target.value);setDay('');}}><option value="">Año</option>{years.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
          </div></fieldset>
        </div>
        <div className="info-banner client-create-note">Al guardar, HAUT creará su acceso con este correo y le enviará un mensaje de bienvenida. Cuando abra la app solo tendrá que pedir su código de 6 dígitos.</div>
        {error&&<div className="alert error-alert" role="alert">{error}</div>}
        <div className="booking-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={saving}>Cancelar</button><button type="submit" className="primary-button" disabled={saving||!branches.length}>{saving?'Creando cliente…':'Agregar cliente'}</button></div>
      </form>
    </section>
  </div>;
}
