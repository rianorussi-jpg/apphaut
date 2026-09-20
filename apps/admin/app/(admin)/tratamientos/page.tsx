'use client';
import {useEffect,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import {formatMoney} from '../../../lib/admin-data';
import TreatmentEditor,{type TreatmentRecord} from '../../../components/TreatmentEditor';
type Category={id:string;name:string;slug:string};
type Branch={id:string;name:string};
type Cabin={id:string;branch_id:string;name:string};
export default function TreatmentsPage(){
 const [treatments,setTreatments]=useState<TreatmentRecord[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);
 const [branches,setBranches]=useState<Branch[]>([]);
 const [cabins,setCabins]=useState<Cabin[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const [editorOpen,setEditorOpen]=useState(false);
 const [editing,setEditing]=useState<TreatmentRecord|null>(null);
 const [query,setQuery]=useState('');
 async function load(){
  if(!supabase){setError('Falta configurar Supabase.');setLoading(false);return;}
  const [t,c,b,cb]=await Promise.all([
   supabase.from('treatments').select('id,name,short_description,description,image_url,base_price,default_duration_minutes,default_session_count,recommended_interval_days,is_active,is_featured,catalog_details_pending,category_id').order('name'),
   supabase.from('treatment_categories').select('id,name,slug').eq('is_active',true).order('sort_order'),
   supabase.from('branches').select('id,name').eq('is_active',true).order('name'),
   supabase.from('cabins').select('id,branch_id,name').eq('is_active',true)
  ]);
  const failure=[t,c,b,cb].find(r=>r.error);
  if(failure?.error){setError(failure.error.message);setLoading(false);return;}
  setTreatments(t.data??[]);setCategories((c.data??[]).filter(item=>['depilacion-laser','corporales','faciales'].includes(item.slug)));
  setBranches(b.data??[]);setCabins(cb.data??[]);setLoading(false);
 }
 useEffect(()=>{void load();},[]);
 const filtered=treatments.filter(t=>t.name.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
 return <section className="page-stack treatment-admin-page">
  <div className="treatment-list-heading"><div><p className="eyebrow">Catálogo · HAUT CLINICAL</p><h2>Tratamientos</h2><p className="muted">Gestiona las fichas e imágenes que aparecen en la app del cliente.</p></div>
   <button type="button" className="primary-button" onClick={()=>{setEditing(null);setEditorOpen(true);setError('');setSuccess('');}}>+ Agregar nuevo tratamiento</button></div>
  {error&&<div className="alert error-alert" role="alert">{error}</div>}
  {success&&<div className="alert" role="status">{success}</div>}
  <div className="treatment-list-toolbar"><label className="treatment-search"><span>⌕</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar tratamiento…" aria-label="Buscar tratamiento"/></label><span className="muted">{filtered.length} tratamientos</span></div>
  {loading?<div className="fullscreen-inline"><div className="spinner"/></div>:filtered.length
   ?<div className="treatment-admin-grid">{filtered.map(t=><article className="treatment-admin-card" key={t.id}>
     <div className="treatment-admin-photo">{t.image_url?<img src={t.image_url} alt={t.name} loading="lazy"/>:<div className="treatment-admin-photo-fallback"><span>✦</span><small>Imagen pendiente</small></div>}</div>
     <div className="treatment-admin-card-body"><div className="treatment-admin-flags"><span className={`mini-pill ${t.is_active?'active-pill':''}`}>{t.is_active?'Activo':'Inactivo'}</span>{t.is_featured&&<span className="mini-pill">★ Favorito</span>}{t.catalog_details_pending&&<span className="mini-pill">Datos pendientes</span>}</div>
     <h3>{t.name}</h3><p className="muted treatment-admin-desc">{t.short_description||'Agrega una descripción para que los clientes conozcan el tratamiento.'}</p>
     <div className="treatment-admin-facts"><span>{t.catalog_details_pending?'Duración pendiente':`${t.default_duration_minutes} min`}</span><span>{t.catalog_details_pending?'Sesiones pendientes':`${t.default_session_count} ${t.default_session_count===1?'sesión':'sesiones'}`}</span><strong>{t.catalog_details_pending?'Precio pendiente':formatMoney(Number(t.base_price))}</strong></div>
     <button type="button" className="treatment-edit-button" onClick={()=>{setEditing(t);setEditorOpen(true);setError('');setSuccess('');}}>Editar tratamiento <span aria-hidden="true">↗</span></button>
     </div></article>)}</div>
   :<div className="empty-state"><strong>{query?'No encontramos tratamientos con ese nombre.':'Todavía no hay tratamientos.'}</strong></div>}
  {editorOpen&&<TreatmentEditor key={editing?.id??'new'} treatment={editing} categories={categories} branches={branches} cabins={cabins} onClose={()=>setEditorOpen(false)} onSaved={message=>{setEditorOpen(false);setSuccess(message);setError('');void load();}}/>}
 </section>;
}
