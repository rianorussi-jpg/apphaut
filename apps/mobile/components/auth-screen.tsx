'use client';

import {FormEvent,useEffect,useState} from 'react';
import {supabase} from '@/lib/supabase';

type Step='email'|'code';

export function AuthScreen({error:initialError=''}:{error?:string}){
  const [step,setStep]=useState<Step>('email');
  const [email,setEmail]=useState('');
  const [code,setCode]=useState('');
  const [error,setError]=useState(initialError);
  const [message,setMessage]=useState('');
  const [saving,setSaving]=useState(false);
  const [resendIn,setResendIn]=useState(0);

  useEffect(()=>{
    if(resendIn<=0)return;
    const timer=window.setInterval(()=>setResendIn(value=>Math.max(0,value-1)),1000);
    return ()=>window.clearInterval(timer);
  },[resendIn]);

  async function sendCode(){
    setError('');setMessage('');
    const normalized=email.trim().toLowerCase();
    if(!normalized||!normalized.includes('@')){setError('Escribe un correo válido.');return;}
    if(!supabase){setError('Supabase no está configurado.');return;}
    setSaving(true);
    try{
      const {error:e}=await supabase.auth.signInWithOtp({
        email:normalized,
        options:{shouldCreateUser:true}
      });
      if(e)throw e;
      setEmail(normalized);
      setCode('');
      setStep('code');
      setResendIn(60);
      setMessage('Te enviamos un código de 6 dígitos. Revisa tu correo.');
    }catch(e){
      setError(e instanceof Error?e.message:'No pudimos enviar el código. Inténtalo nuevamente.');
    }finally{setSaving(false);}
  }

  async function verifyCode(e:FormEvent){
    e.preventDefault();setError('');setMessage('');
    if(!supabase){setError('Supabase no está configurado.');return;}
    const token=code.replace(/\D/g,'').slice(0,6);
    if(token.length!==6){setError('Escribe el código de 6 dígitos.');return;}
    setSaving(true);
    try{
      const {error:e}=await supabase.auth.verifyOtp({email:email.trim().toLowerCase(),token,type:'email'});
      if(e)throw e;
    }catch(e){
      setError(e instanceof Error?e.message:'El código no es válido o ya expiró.');
    }finally{setSaving(false);}
  }

  if(step==='code')return <main className="auth-wrap"><section className="auth-card otp-card">
    <div className="auth-mark">H</div>
    <p className="brand-kicker">HAUT CLINICAL</p>
    <h1>Revisa tu correo</h1>
    <p className="subtle auth-copy">Escribe el código de 6 dígitos que enviamos a <strong>{email}</strong>.</p>
    <form onSubmit={verifyCode} className="auth-form otp-form">
      <label className="otp-label">Código de acceso
        <input
          className="otp-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
          placeholder="000000"
          autoFocus
          required
        />
      </label>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {message&&<p className="form-success" role="status">{message}</p>}
      <button type="submit" disabled={saving||code.length!==6} className="primary-button">{saving?'Verificando…':'Entrar a mi cuenta'}</button>
      <div className="otp-actions">
        <button type="button" className="text-button" onClick={()=>{setStep('email');setCode('');setError('');setMessage('');}}>Usar otro correo</button>
        <button type="button" className="text-button" disabled={saving||resendIn>0} onClick={()=>void sendCode()}>{resendIn>0?`Reenviar en ${resendIn}s`:'Reenviar código'}</button>
      </div>
    </form>
    <p className="small-print">Tu sesión permanecerá iniciada en este dispositivo hasta que cierres sesión.</p>
  </section></main>;

  return <main className="auth-wrap"><section className="auth-card">
    <div className="auth-mark">H</div>
    <p className="brand-kicker">HAUT CLINICAL</p>
    <h1>Tu espacio Haut</h1>
    <p className="subtle auth-copy">Consulta tus tratamientos, próximas citas, promociones y beneficios.</p>
    <form onSubmit={e=>{e.preventDefault();void sendCode();}} className="auth-form email-only-form">
      <label>Correo
        <input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="tu@correo.com" autoFocus/>
      </label>
      {error&&<p className="form-error" role="alert">{error}</p>}
      {message&&<p className="form-success" role="status">{message}</p>}
      <button type="submit" disabled={saving} className="primary-button">{saving?'Enviando código…':'Continuar'}</button>
    </form>
    <p className="small-print">No necesitas contraseña. Te enviaremos un código de acceso a tu correo.</p>
  </section></main>;
}
