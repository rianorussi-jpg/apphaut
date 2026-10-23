'use client';
import {FormEvent,useState,useEffect} from 'react';import Link from 'next/link';
import {MobileShell} from '@/components/MobileShell';import {useClient} from '@/components/ClientProvider';import {supabase} from '@/lib/supabase';import {Icon} from '@/components/Icon';
export default function ProfilePage(){
 const {session,data,refresh,signOut}=useClient();
 const [editing,setEditing]=useState(false);const [name,setName]=useState('');const [phone,setPhone]=useState('');const [branch,setBranch]=useState('');
 const [error,setError]=useState('');const [success,setSuccess]=useState('');const [saving,setSaving]=useState(false);const [deleting,setDeleting]=useState(false);
 useEffect(()=>{setName(data?.profile?.full_name??'');setPhone(data?.profile?.phone??'');setBranch(data?.profile?.preferred_branch_id??'');},[data?.profile]);
 async function save(e:FormEvent){e.preventDefault();setError('');setSuccess('');if(!supabase)return;if(name.trim().length<2||phone.replace(/\D/g,'').length<10||!branch){setError('Revisa tu nombre, teléfono y sucursal.');return;}setSaving(true);const result=await supabase.from('profiles').update({full_name:name.trim(),phone:phone.trim(),preferred_branch_id:branch}).eq('id',session.user.id);setSaving(false);if(result.error)setError(result.error.message);else{setEditing(false);setSuccess('Datos actualizados.');await refresh();}}
 async function deleteAccount(){
   if(!supabase||deleting)return;
   const confirmed=window.confirm('¿Eliminar tu cuenta de HAUT? Esta acción es permanente y eliminará tu acceso, tratamientos, citas y solicitudes asociadas que puedan borrarse.');
   if(!confirmed)return;
   const finalConfirmation=window.confirm('Esta acción no se puede deshacer. ¿Confirmas que deseas eliminar tu cuenta?');
   if(!finalConfirmation)return;
   setError('');setSuccess('');setDeleting(true);
   try{
     const {data:result,error:functionError}=await supabase.functions.invoke('delete-my-account',{body:{confirm:true}});
     if(functionError)throw functionError;
     if(result?.error)throw new Error(result.error);
     await supabase.auth.signOut().catch(()=>undefined);
     window.location.assign('/acceso');
   }catch(e){setError(e instanceof Error?e.message:'No pudimos eliminar tu cuenta. Inténtalo nuevamente.');setDeleting(false);}
 }
 const currentBranch=data?.branches.find(b=>b.id===data.profile?.preferred_branch_id)?.name;
 return <MobileShell title="Mi perfil" eyebrow="MI CUENTA · HAUT"><section className="profile-hero"><div className="profile-hero-avatar">{(data?.profile?.full_name||'H').charAt(0).toUpperCase()}</div><span className="eyebrow">TU ESPACIO PERSONAL</span><h2>{data?.profile?.full_name||'Mi cuenta'}</h2><p>{session.user.email}</p><span className="profile-hero-branch"><Icon name="pin" size={14}/> Haut {currentBranch||'Sucursal por seleccionar'}</span></section>
 {success&&<p className="form-success" role="status">{success}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
 {editing?<form className="card edit-form profile-form" onSubmit={save}><div className="section-title"><h2>Mis datos</h2></div><label>Nombre completo<input value={name} required onChange={e=>setName(e.target.value)}/></label><label>Número de teléfono<input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)}/></label><label>Mi sucursal<select required value={branch} onChange={e=>setBranch(e.target.value)}><option value="">Selecciona una sucursal</option>{data?.branches.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label><button className="primary-button" disabled={saving||deleting}>{saving?'Guardando…':'Guardar cambios'}</button><button type="button" className="secondary-button" onClick={()=>setEditing(false)} disabled={deleting}>Cancelar</button><div className="delete-account-box"><strong>Eliminar cuenta</strong><p>Elimina permanentemente tu cuenta y el acceso a tus datos dentro de la app.</p><button type="button" className="danger-button" onClick={()=>void deleteAccount()} disabled={deleting}>{deleting?'Eliminando cuenta…':'Eliminar mi cuenta'}</button></div></form>:<button className="secondary-button profile-edit" onClick={()=>setEditing(true)}><Icon name="user" size={17}/> Editar mis datos <Icon name="forward" size={17}/></button>}
 <div className="section-title"><div><small>TU EXPERIENCIA</small><h2>Mi cuenta</h2></div></div><div className="profile-menu"><Link href="/mis-tratamientos"><span><Icon name="layers" size={20}/></span><strong>Mis tratamientos</strong><Icon name="forward" size={17}/></Link><Link href="/mis-citas"><span><Icon name="calendar" size={20}/></span><strong>Mis citas</strong><Icon name="forward" size={17}/></Link><Link href="/#paquetes"><span><Icon name="sparkles" size={20}/></span><strong>Paquetes</strong><Icon name="forward" size={17}/></Link></div>
 <button className="profile-signout" onClick={()=>void signOut()}><Icon name="logout" size={18}/> Cerrar sesión</button>
 <nav className="profile-legal-links" aria-label="Información legal y soporte"><Link href="/terminos">Términos</Link><span>·</span><Link href="/privacidad">Privacidad</Link><span>·</span><Link href="/soporte">Soporte</Link></nav>
 </MobileShell>;
}
