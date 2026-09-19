'use client';
import {FormEvent,useEffect,useState} from 'react';import {supabase} from '../../../lib/supabase';
type Promo={id:string;title:string;description:string|null;is_active:boolean;created_at:string};
export default function PromocionesPage(){const [rows,setRows]=useState<Promo[]>([]);const[title,setTitle]=useState('');const[description,setDescription]=useState('');const[imageUrl,setImageUrl]=useState('');const[error,setError]=useState('');const[message,setMessage]=useState('');const[busy,setBusy]=useState(false);
 async function load(){if(!supabase)return;const {data,error:e}=await supabase.from('promotions').select('id,title,description,is_active,created_at').order('created_at',{ascending:false});if(e)setError(e.message);else setRows(data??[]);}
 useEffect(()=>{void load();},[]);
 async function submit(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError('');setMessage('');const {error:err}=await supabase.from('promotions').insert({title:title.trim(),description:description.trim()||null,image_url:imageUrl.trim()||null,is_active:true});setBusy(false);if(err)setError(err.message);else{setTitle('');setDescription('');setImageUrl('');setMessage('Promoción publicada.');await load();}}
 async function toggle(p:Promo){if(!supabase)return;setError('');const{error:e}=await supabase.from('promotions').update({is_active:!p.is_active}).eq('id',p.id);if(e)setError(e.message);else await load();}
 return <section className="page-stack"><div className="page-heading"><p className="eyebrow">Cliente</p><h2>Promociones</h2><p className="muted">Publica promociones que los clientes verán en la app. Crear y modificar requiere superadmin.</p></div>{error&&<div className="alert error-alert">{error}</div>}{message&&<div className="alert">{message}</div>}
 <form onSubmit={submit} className="panel-card" style={{display:'grid',gap:12,maxWidth:640}}><label>Título<br/><input required maxLength={150} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Descripción<br/><textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>URL de imagen (opcional)<br/><input type="url" placeholder="https://..." value={imageUrl} onChange={e=>setImageUrl(e.target.value)}/></label><button disabled={busy}>Publicar promoción</button></form>
 {rows.map(p=><article className="panel-card" key={p.id}><h3>{p.title}</h3><p>{p.description}</p><span className="mini-pill">{p.is_active?'Visible':'Oculta'}</span> <button onClick={()=>void toggle(p)}>{p.is_active?'Ocultar':'Activar'}</button></article>)}
 {!rows.length&&<div className="empty-state">No hay promociones registradas.</div>}
 </section>;
}
