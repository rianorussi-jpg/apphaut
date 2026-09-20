'use client';

import {FormEvent,useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

export type TreatmentRecord = {
  id:string;name:string;short_description:string|null;description:string|null;image_url:string|null;
  base_price:number|string;default_duration_minutes:number;default_session_count:number;
  recommended_interval_days:number|null;is_active:boolean;is_featured:boolean;
  catalog_details_pending:boolean;category_id:string|null;
};
type Category={id:string;name:string;slug:string};
type Branch={id:string;name:string};
type Cabin={id:string;branch_id:string;name:string};

export default function TreatmentEditor({treatment,categories,branches,cabins,onClose,onSaved}:{
 treatment:TreatmentRecord|null;categories:Category[];branches:Branch[];cabins:Cabin[];
 onClose:()=>void;onSaved:(message:string)=>void;
}){
 const [name,setName]=useState(treatment?.name??'');
 const [description,setDescription]=useState(treatment?.description??treatment?.short_description??'');
 const [categoryId,setCategoryId]=useState(treatment?.category_id??'');
 const [price,setPrice]=useState(treatment?.catalog_details_pending?'':treatment?String(treatment.base_price):'');
 const [duration,setDuration]=useState(treatment?.catalog_details_pending?'':treatment?String(treatment.default_duration_minutes):'60');
 const [sessions,setSessions]=useState(treatment?.catalog_details_pending?'':treatment?String(treatment.default_session_count):'1');
 const [interval,setInterval]=useState(treatment?.recommended_interval_days==null?'':String(treatment.recommended_interval_days));
 const [featured,setFeatured]=useState(treatment?.is_featured??false);
 const [active,setActive]=useState(treatment?.is_active??true);
 const [imageUrl,setImageUrl]=useState(treatment?.image_url??'');
 const [file,setFile]=useState<File|null>(null);
 const [preview,setPreview]=useState(treatment?.image_url??'');
 const [chosenBranches,setChosenBranches]=useState<string[]>([]);
 const [chosenCabins,setChosenCabins]=useState<string[]>([]);
 const [loadingLinks,setLoadingLinks]=useState(Boolean(treatment));
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{
  if(!treatment||!supabase)return;
  let mounted=true;
  void Promise.all([
    supabase.from('treatment_branches').select('branch_id').eq('treatment_id',treatment.id),
    supabase.from('treatment_cabins').select('cabin_id').eq('treatment_id',treatment.id),
  ]).then(([b,c])=>{
    if(!mounted)return;
    if(b.error||c.error)setError(b.error?.message??c.error?.message??'No se pudo cargar la asignación de cabinas.');
    else {setChosenBranches((b.data??[]).map(row=>row.branch_id));setChosenCabins((c.data??[]).map(row=>row.cabin_id));}
    setLoadingLinks(false);
  });
  return()=>{mounted=false;};
 },[treatment]);
 useEffect(()=>{
  if(!file){setPreview(imageUrl);return;}
  const url=URL.createObjectURL(file);setPreview(url);
  return()=>URL.revokeObjectURL(url);
 },[file,imageUrl]);
 const validBranches=chosenBranches.every(branchId=>chosenCabins.some(id=>cabins.some(c=>c.id===id&&c.branch_id===branchId)));
 function chooseFile(nextFile:File|null){
  setError('');
  if(!nextFile){setFile(null);return;}
  if(!['image/jpeg','image/png','image/webp','image/avif'].includes(nextFile.type)){
   setError('Usa una imagen JPG, PNG, WebP o AVIF.');return;
  }
  if(nextFile.size>10*1024*1024){setError('La imagen debe pesar menos de 10 MB.');return;}
  setFile(nextFile);
 }
 async function save(e:FormEvent){
  e.preventDefault();setError('');
  if(!supabase){setError('Supabase no está configurado.');return;}
  if(loadingLinks){setError('Espera a que terminen de cargar las sucursales y cabinas.');return;}
  if(!name.trim()||!categoryId||!price.trim()||!Number.isFinite(Number(price))||Number(price)<0||
     !Number.isInteger(Number(duration))||Number(duration)<1||!Number.isInteger(Number(sessions))||Number(sessions)<1||
     (interval!==''&&(!Number.isInteger(Number(interval))||Number(interval)<0))){
   setError('Verifica nombre, categoría, precio, duración y número de sesiones.');return;
  }
  if(!validBranches){setError('Selecciona por lo menos una cabina compatible en cada sucursal marcada.');return;}
  setSaving(true);
  try{
   let finalImageUrl=imageUrl.trim()||null;
   if(file){
     const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/avif':'avif'}[file.type]??'jpg';
     const path=`treatments/${crypto.randomUUID()}.${extension}`;
     const upload=await supabase.storage.from('treatment-images').upload(path,file,{contentType:file.type,upsert:false,cacheControl:'3600'});
     if(upload.error)throw new Error(`No se pudo subir la imagen: ${upload.error.message}. Verifica el bucket treatment-images y sus políticas.`);
     finalImageUrl=supabase.storage.from('treatment-images').getPublicUrl(path).data.publicUrl;
   }
   const payload={
     name:name.trim(),short_description:description.trim()||null,description:description.trim()||null,
     category_id:categoryId,base_price:Number(price),default_duration_minutes:Number(duration),
     default_session_count:Number(sessions),recommended_interval_days:interval===''?null:Number(interval),
     is_featured:featured,is_active:active,catalog_details_pending:false,image_url:finalImageUrl,
   };
   let treatmentId=treatment?.id;
   if(treatmentId){
    const result=await supabase.from('treatments').update(payload).eq('id',treatmentId).select('id').single();
    if(result.error)throw new Error('No se pudo actualizar el tratamiento: '+result.error.message);
   }else{
    const slug=name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
    const result=await supabase.from('treatments').insert({...payload,slug:`${slug}-${crypto.randomUUID().slice(0,8)}`}).select('id').single();
    if(result.error||!result.data)throw new Error('No se pudo crear el tratamiento: '+(result.error?.message??'Respuesta vacía'));
    treatmentId=result.data.id;
   }
   // Inserta asignaciones nuevas antes de eliminar las anteriores. Un fallo se
   // reporta explícitamente y no se oculta como éxito.
   const currentBranches=await supabase.from('treatment_branches').select('branch_id').eq('treatment_id',treatmentId);
   const currentCabins=await supabase.from('treatment_cabins').select('cabin_id').eq('treatment_id',treatmentId);
   if(currentBranches.error||currentCabins.error)throw new Error(currentBranches.error?.message??currentCabins.error?.message??'No se pudieron cargar las relaciones');
   const beforeBranches=(currentBranches.data??[]).map(row=>row.branch_id);
   const beforeCabins=(currentCabins.data??[]).map(row=>row.cabin_id);
   const addBranches=chosenBranches.filter(id=>!beforeBranches.includes(id));
   if(addBranches.length){
    const result=await supabase.from('treatment_branches').insert(addBranches.map(branch_id=>({treatment_id:treatmentId,branch_id,is_active:true})));
    if(result.error)throw new Error('No se pudieron habilitar las sucursales: '+result.error.message);
   }
   const addCabins=chosenCabins.filter(id=>!beforeCabins.includes(id));
   if(addCabins.length){
    const result=await supabase.from('treatment_cabins').insert(addCabins.map(cabin_id=>({treatment_id:treatmentId,branch_id:cabins.find(c=>c.id===cabin_id)!.branch_id,cabin_id})));
    if(result.error)throw new Error('No se pudieron habilitar las cabinas: '+result.error.message);
   }
   const removeCabins=beforeCabins.filter(id=>!chosenCabins.includes(id));
   if(removeCabins.length){
    const result=await supabase.from('treatment_cabins').delete().eq('treatment_id',treatmentId).in('cabin_id',removeCabins);
    if(result.error)throw new Error('No se pudieron desasignar las cabinas: '+result.error.message);
   }
   const removeBranches=beforeBranches.filter(id=>!chosenBranches.includes(id));
   if(removeBranches.length){
    const result=await supabase.from('treatment_branches').delete().eq('treatment_id',treatmentId).in('branch_id',removeBranches);
    if(result.error)throw new Error('No se pudieron desasignar las sucursales: '+result.error.message);
   }
   onSaved(treatment?'Tratamiento actualizado. La imagen ya está disponible en el catálogo del cliente.':'Tratamiento creado. Ya aparece en el catálogo del cliente.');
  }catch(cause){
   // Solo borrar archivos recién subidos cuando falló antes de actualizar/crear
   // el registro; no borrar imágenes existentes ni imágenes ya referenciadas.
   setError(cause instanceof Error?cause.message:'Ocurrió un error al guardar el tratamiento.');
  }finally{setSaving(false);}
 }
 return <div className="modal-backdrop treatment-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&!saving&&onClose()}>
   <section className="treatment-editor" role="dialog" aria-modal="true" aria-labelledby="treatment-editor-title">
    <div className="treatment-editor-top"><div><p className="eyebrow">Catálogo HAUT · Administración</p>
      <h2 id="treatment-editor-title">{treatment?'Editar tratamiento':'Nuevo tratamiento'}</h2>
      <p className="muted">Configura su ficha, imagen y disponibilidad en sucursales.</p>
     </div><button type="button" className="modal-close" aria-label="Cerrar" disabled={saving} onClick={onClose}>×</button></div>
    <form onSubmit={save} className="treatment-editor-content">
     {error&&<div className="alert error-alert" role="alert">{error}</div>}
     <div className="treatment-editor-columns"><div className="treatment-editor-fields">
      <div className="editor-section"><p className="editor-section-label">01 · Información general</p>
       <label className="form-field">Nombre del tratamiento<input required maxLength={140} value={name} onChange={e=>setName(e.target.value)} placeholder="Ej. Limpieza facial"/></label>
       <label className="form-field">Descripción<textarea rows={4} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Describe brevemente el tratamiento…"/></label>
       <label className="form-field">Categoría<select required value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Selecciona una categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      </div>
      <div className="editor-section"><p className="editor-section-label">02 · Precio y sesiones</p>
       <div className="editor-two"><label className="form-field">Precio base (MXN)<input type="number" min="0" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
       <label className="form-field">Duración por sesión (min)<input type="number" min="1" max="600" required value={duration} onChange={e=>setDuration(e.target.value)}/></label>
       <label className="form-field">Número de sesiones<input type="number" min="1" max="200" required value={sessions} onChange={e=>setSessions(e.target.value)}/></label>
       <label className="form-field">Intervalo recomendado (días)<input type="number" min="0" value={interval} placeholder="Opcional" onChange={e=>setInterval(e.target.value)}/></label></div>
      </div>
      <div className="editor-section"><p className="editor-section-label">03 · Disponibilidad</p>
       <div className="editor-check-grid">{branches.map(b=><label className={`editor-check ${chosenBranches.includes(b.id)?'checked':''}`} key={b.id}><input type="checkbox" checked={chosenBranches.includes(b.id)} onChange={e=>{setChosenBranches(old=>e.target.checked?[...old,b.id]:old.filter(id=>id!==b.id));if(!e.target.checked)setChosenCabins(old=>old.filter(id=>cabins.find(c=>c.id===id)?.branch_id!==b.id));}}/>{b.name}</label>)}</div>
       {!!chosenBranches.length&&<><p className="muted">Cabinas compatibles por sucursal</p><div className="editor-check-grid">{cabins.filter(c=>chosenBranches.includes(c.branch_id)).map(c=><label className={`editor-check ${chosenCabins.includes(c.id)?'checked':''}`} key={c.id}><input type="checkbox" checked={chosenCabins.includes(c.id)} onChange={e=>setChosenCabins(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/>{branches.find(b=>b.id===c.branch_id)?.name} · {c.name}</label>)}</div></>}
       <small className="muted">Sin sucursales asignadas, el tratamiento se verá en el catálogo pero no se podrá agendar.</small>
      </div>
     </div><aside className="treatment-editor-side"><div className="editor-section"><p className="editor-section-label">Fotografía del tratamiento</p>
      <div className="editor-image-preview">{preview?<img src={preview} alt="Vista previa del tratamiento"/>:<div className="editor-photo-empty"><span>✦</span><strong>Imagen del tratamiento</strong><small>Se mostrará en el catálogo del cliente</small></div>}</div>
      <label className="editor-upload">{file?'Cambiar fotografía':'Seleccionar fotografía'}<input type="file" accept="image/jpeg,image/png,image/webp,image/avif" onChange={e=>chooseFile(e.target.files?.[0]??null)} /></label>
      <small className="muted">JPG, PNG, WebP o AVIF · hasta 10 MB. Se guarda en Supabase Storage.</small>
      {file&&<button type="button" className="editor-link" onClick={()=>setFile(null)}>Descartar imagen nueva</button>}
      </div>
      <div className="editor-section editor-settings"><p className="editor-section-label">Publicación</p>
       <label className="editor-toggle"><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/><span><strong>Destacar en Favoritos</strong><small>También aparecerá entre los tratamientos destacados.</small></span></label>
       <label className="editor-toggle"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/><span><strong>Tratamiento activo</strong><small>Visible en el catálogo del cliente.</small></span></label>
      </div>
     </aside></div>
     <footer className="editor-footer"><button type="button" className="secondary-button" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="primary-button" disabled={saving||loadingLinks}>{saving?'Guardando…':treatment?'Guardar cambios':'Agregar tratamiento'}</button></footer>
    </form>
   </section>
  </div>;
}
