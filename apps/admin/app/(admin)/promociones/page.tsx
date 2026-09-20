'use client';
import {FormEvent,useEffect,useRef,useState} from 'react';
import {supabase} from '../../../lib/supabase';
import {Icon} from '../../../components/Icon';
import {PromotionImageCropper} from '../../../components/PromotionImageCropper';
import type {PromotionImageCropperHandle} from '../../../components/PromotionImageCropper';

type Promo={id:string;title:string;description:string|null;image_url:string|null;treatment_id:string|null;is_active:boolean;created_at:string};
type Treatment={id:string;name:string};
const allowedTypes=['image/jpeg','image/png','image/webp','image/avif'];
export default function PromocionesPage(){
 const [rows,setRows]=useState<Promo[]>([]);
 const [treatments,setTreatments]=useState<Treatment[]>([]);
 const [editingId,setEditingId]=useState<string|null>(null);
 const [title,setTitle]=useState('');const [description,setDescription]=useState('');
 const [imageUrl,setImageUrl]=useState('');const [treatmentId,setTreatmentId]=useState('');
 const [file,setFile]=useState<File|null>(null);const [preview,setPreview]=useState<string|null>(null);
 const [cropChanged,setCropChanged]=useState(false);
 const [showForm,setShowForm]=useState(false);const [error,setError]=useState('');
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 const cropper=useRef<PromotionImageCropperHandle|null>(null);
 const form=useRef<HTMLFormElement|null>(null);
 useEffect(()=>{if(!file){setPreview(null);return;}const url=URL.createObjectURL(file);setPreview(url);return()=>URL.revokeObjectURL(url);},[file]);
 useEffect(()=>{if(showForm)form.current?.scrollIntoView({behavior:'smooth',block:'start'});},[showForm,editingId]);
 async function load(){if(!supabase)return;const [promos,catalog]=await Promise.all([supabase.from('promotions').select('id,title,description,image_url,treatment_id,is_active,created_at').order('created_at',{ascending:false}),supabase.from('treatments').select('id,name').eq('is_active',true).order('name')]);if(promos.error)setError(promos.error.message);else setRows(promos.data??[]);if(catalog.error)setError(catalog.error.message);else setTreatments(catalog.data??[]);}
 useEffect(()=>{void load();},[]);
 function reset(){setTitle('');setDescription('');setImageUrl('');setTreatmentId('');setFile(null);setCropChanged(false);setEditingId(null);}
 function openNew(){reset();setShowForm(true);setError('');setMessage('');}
 function openEdit(p:Promo){setEditingId(p.id);setTitle(p.title);setDescription(p.description??'');setImageUrl(p.image_url??'');setTreatmentId(p.treatment_id??'');setFile(null);setCropChanged(false);setShowForm(true);setError('');setMessage('');}
 function close(){reset();setShowForm(false);setError('');}
 function chooseFile(next:File|null){if(!next)return;if(!allowedTypes.includes(next.type)){setError('Elige una imagen JPG, PNG, WebP o AVIF.');return;}if(next.size>10*1024*1024){setError('La imagen no puede superar 10 MB.');return;}setError('');setFile(next);setCropChanged(true);}
 async function submit(e:FormEvent){e.preventDefault();if(!supabase||busy)return;setBusy(true);setError('');setMessage('');try{
   let url=imageUrl.trim()||null;
   if(file||cropChanged){
     if(file&&!preview)throw new Error('Espera un momento a que se prepare la vista previa de la imagen.');
     if(!cropper.current)throw new Error('Espera a que cargue el editor de imagen.');
     const cropped=await cropper.current.toBlob();
     const path=`promotions/${crypto.randomUUID()}.webp`;
     const upload=await supabase.storage.from('treatment-images').upload(path,cropped,{contentType:'image/webp',upsert:false,cacheControl:'3600'});
     if(upload.error)throw upload.error;
     url=supabase.storage.from('treatment-images').getPublicUrl(path).data.publicUrl;
   }
   if(!url)throw new Error('Agrega una imagen para que la promoción se vea en el carrusel.');
   const payload={title:title.trim(),description:description.trim()||null,image_url:url,treatment_id:treatmentId||null};
   const result=editingId?await supabase.from('promotions').update(payload).eq('id',editingId):await supabase.from('promotions').insert({...payload,is_active:true});
   if(result.error)throw result.error;
   const updated=Boolean(editingId);close();setMessage(updated?'Promoción actualizada. La imagen ya está disponible en la app.':'Promoción publicada. Ya está disponible en la app.');await load();
 }catch(cause){setError(cause instanceof Error?cause.message:'No se pudo guardar la promoción.');}finally{setBusy(false);}}
 async function toggle(p:Promo){if(!supabase)return;setError('');setMessage('');const {error:e}=await supabase.from('promotions').update({is_active:!p.is_active}).eq('id',p.id);if(e)setError(e.message);else await load();}
 const currentImage=preview||imageUrl;
 return <section className="page-stack promotions-admin-page">
   <div className="treatment-list-heading"><div><p className="eyebrow">COMUNICACIÓN CON CLIENTES</p><h2>Promociones</h2><p className="muted">Edita imágenes y mensajes de tus promociones. El encuadre que guardes será el mismo del carrusel en Inicio.</p></div><button type="button" className="primary-button" onClick={showForm?close:openNew}>{showForm?'Cerrar editor':'+ Nueva promoción'}</button></div>
   {error&&<div className="alert error-alert" role="alert">{error}</div>}{message&&<div className="alert success-alert" role="status">{message}</div>}
   {showForm&&<form id="promotion-editor" ref={form} onSubmit={submit} className="panel-card promotion-editor"><div className="section-heading"><div><p className="eyebrow">{editingId?'EDITAR PROMOCIÓN':'NUEVA PROMOCIÓN'}</p><h3>{editingId?'Actualiza la imagen y los detalles':'Comparte una novedad con tus clientes'}</h3></div><button type="button" className="secondary-button" onClick={close}>Cancelar</button></div>
     <div className="promotion-form-grid"><div className="promotion-form-fields"><label>Título de la promoción<input required maxLength={150} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Nombre de la promoción"/></label><label>Descripción<textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Cuéntale al cliente qué incluye…"/></label><label>Tratamiento relacionado (opcional)<select value={treatmentId} onChange={e=>setTreatmentId(e.target.value)}><option value="">Promoción general · Ver promoción</option>{treatments.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><p className="muted promotion-note">El cliente verá la foto limpia en Inicio y podrá consultar estos detalles al pulsar «Ver promoción».</p></div>
     <div className="promotion-upload-side"><span className="editor-section-label">IMAGEN DE LA PROMOCIÓN</span><PromotionImageCropper ref={cropper} src={currentImage} onAdjusted={()=>setCropChanged(true)}/><label className="editor-upload">{currentImage?'Cambiar fotografía':'Seleccionar fotografía'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e=>{chooseFile(e.target.files?.[0]??null);e.target.value='';}}/></label><label className="promotion-url-label">O utiliza una URL de imagen<input type="url" placeholder="https://..." value={imageUrl} onChange={e=>{setImageUrl(e.target.value);setFile(null);setCropChanged(false);}}/></label><small>JPG, PNG, WebP o AVIF · hasta 10 MB. El encuadre se guarda en 1200 × 675 px; para recortar imágenes externas que no permitan edición, selecciona el archivo desde tu computadora.</small></div></div>
     <div className="editor-footer"><button className="primary-button" type="submit" disabled={busy}>{busy?'Guardando…':editingId?'Guardar cambios':'Publicar promoción'}</button></div>
   </form>}
   <div className="promotion-list-admin">{rows.length?rows.map(p=><article className="promotion-admin-card" key={p.id}><div className="promotion-admin-image">{p.image_url?<img src={p.image_url} alt="" loading="lazy"/>:<Icon name="image" size={25}/>}</div><div className="promotion-admin-text"><span className={`mini-pill ${p.is_active?'active-pill':''}`}>{p.is_active?'Publicada':'Oculta'}</span><h3>{p.title}</h3><p className="muted">{p.description||'Sin descripción'}</p>{p.treatment_id&&<small>Con enlace a tratamiento</small>}</div><div className="promotion-card-actions"><button type="button" className="secondary-button" onClick={()=>openEdit(p)}><Icon name="sliders" size={16}/> Editar</button><button type="button" className="secondary-button" onClick={()=>void toggle(p)}>{p.is_active?'Ocultar':'Activar'}</button></div></article>):<div className="empty-state large-empty"><strong>Aún no hay promociones.</strong><span>Crea tu primera promoción y aparecerá en Inicio cuando esté publicada.</span></div>}</div>
 </section>;
}
