'use client';
import {FormEvent,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';
import type {Branch} from '@/lib/types';

type Mode='login'|'register';
export function AuthScreen({defaultMode='login',error:initialError=''}:{defaultMode?:Mode;error?:string}){
 const [mode,setMode]=useState<Mode>(defaultMode);
 const [name,setName]=useState('');const [phone,setPhone]=useState('');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');
 const [branchId,setBranchId]=useState('');const [branches,setBranches]=useState<Branch[]>([]);
 const [error,setError]=useState(initialError);const [message,setMessage]=useState('');const [saving,setSaving]=useState(false);
 useEffect(()=>{if(!supabase)return;supabase.from('branches').select('id,name,slug,phone,address').eq('is_active',true).order('name').then(({data,error:e})=>{if(e)setError(e.message);setBranches(data??[]);});},[]);
 async function submit(e:FormEvent){e.preventDefault();setError('');setMessage('');if(!supabase){setError('Supabase no configurado.');return;}
  if(mode==='register'){
   if(name.trim().length<2){setError('Escribe tu nombre completo.');return;}
   if(phone.replace(/\D/g,'').length<10){setError('Escribe un teléfono válido de al menos 10 dígitos.');return;}
   if(!branchId){setError('Selecciona tu sucursal.');return;}
   if(password.length<8){setError('Usa una contraseña de al menos 8 caracteres.');return;}
   if(password!==confirm){setError('Las contraseñas no coinciden.');return;}
  }
  setSaving(true);
  try{
   if(mode==='login'){
    const {error:e}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(e)throw e;
   } else {
    const {data,error:e}=await supabase.auth.signUp({email:email.trim(),password,
      options:{data:{full_name:name.trim(),phone:phone.trim(),preferred_branch_id:branchId},emailRedirectTo:window.location.origin}});
    if(e)throw e;
    if(!data.session){setMessage('Revisa tu correo y confirma tu cuenta. Después inicia sesión aquí.');setMode('login');setPassword('');setConfirm('');}
   }
  }catch(e){setError(e instanceof Error?e.message:'No se pudo completar la operación.');}finally{setSaving(false);}
 }
 return <main className="auth-wrap"><section className="auth-card">
   <div className="auth-mark">H</div><p className="brand-kicker">HAUT CLINICAL</p>
   <h1>{mode==='login'?'Bienvenido a Haut':'Crea tu cuenta'}</h1><p className="subtle">{mode==='login'?'Inicia sesión para acceder a tus citas, tratamientos y beneficios.':'Regístrate para consultar tu experiencia Haut.'}</p>
   <div className="auth-switch"><button className={mode==='login'?'selected':''} type="button" onClick={()=>{setMode('login');setError('');setMessage('');}}>Iniciar sesión</button><button type="button" className={mode==='register'?'selected':''} onClick={()=>{setMode('register');setError('');setMessage('');}}>Registrarse</button></div>
   <form onSubmit={submit} className="auth-form">
    {mode==='register'&&<><label>Nombre completo<input required autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Tu nombre"/></label><label>Número de teléfono<input type="tel" required autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="442 123 4567"/></label></>}
    <label>Correo electrónico<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com"/></label>
    <label>Contraseña<input type="password" minLength={mode==='register'?8:undefined} required autoComplete={mode==='register'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••"/></label>
    {mode==='register'&&<><label>Confirmar contraseña<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="••••••••"/></label><label>Tu sucursal<select required value={branchId} onChange={e=>setBranchId(e.target.value)}><option value="">Selecciona tu sucursal</option>{branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label>{!branches.length&&<p className="subtle">No hay sucursales disponibles. Solicita a Haut que las configure.</p>}</>}
    {error&&<p className="form-error" role="alert">{error}</p>}{message&&<p className="form-success" role="status">{message}</p>}
    <button type="submit" disabled={saving||(mode==='register'&&!branches.length)} className="primary-button">{saving?'Un momento…':mode==='login'?'Iniciar sesión':'Crear cuenta'}</button>
   </form><p className="small-print">Al registrarte tus datos se utilizarán para gestionar tu cuenta de Haut Clinical.</p>
  </section></main>
}
