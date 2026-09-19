'use client';
import {FormEvent,useEffect,useState} from 'react';import {supabase} from '../../../lib/supabase';import {formatMoney} from '../../../lib/admin-data';
type Treatment={id:string;name:string;short_description:string|null;base_price:number|string;default_duration_minutes:number;default_session_count:number;is_active:boolean;is_featured:boolean;category_id:string|null};
type Category={id:string;name:string};type Branch={id:string;name:string};type Cabin={id:string;branch_id:string;name:string};
export default function TreatmentsPage(){const [treatments,setTreatments]=useState<Treatment[]>([]);const[categories,setCategories]=useState<Category[]>([]);const[branches,setBranches]=useState<Branch[]>([]);const[cabins,setCabins]=useState<Cabin[]>([]);const [chosenBranches,setChosenBranches]=useState<string[]>([]);const [chosenCabins,setChosenCabins]=useState<string[]>([]);
 const [name,setName]=useState('');const[description,setDescription]=useState('');const[imageUrl,setImageUrl]=useState('');const[categoryId,setCategoryId]=useState('');const[price,setPrice]=useState('');const[duration,setDuration]=useState('60');const[sessions,setSessions]=useState('1');const[interval,setInterval]=useState('');const[featured,setFeatured]=useState(false);
 const[loading,setLoading]=useState(true);const[saving,setSaving]=useState(false);const[error,setError]=useState('');const[success,setSuccess]=useState('');
 async function load(){if(!supabase){setError('Supabase no configurado.');setLoading(false);return;}
  const[t,c,b,cb]=await Promise.all([supabase.from('treatments').select('id,name,short_description,base_price,default_duration_minutes,default_session_count,is_active,is_featured,category_id').order('name'),supabase.from('treatment_categories').select('id,name').order('sort_order'),supabase.from('branches').select('id,name').eq('is_active',true).order('name'),supabase.from('cabins').select('id,branch_id,name').eq('is_active',true)]);
  for(const r of [t,c,b,cb])if(r.error){setError(r.error.message);setLoading(false);return;}
  setTreatments(t.data??[]);setCategories(c.data??[]);setBranches(b.data??[]);setCabins(cb.data??[]);setLoading(false);
 }
 useEffect(()=>{void load();},[]);
 const slugify=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
 async function create(e:FormEvent){e.preventDefault();setError('');setSuccess('');if(!supabase)return;
  if(!chosenBranches.length||!chosenCabins.length){setError('Selecciona al menos una sucursal y una cabina compatible.');return;}
  if(chosenBranches.some(b=>!chosenCabins.some(c=>cabins.find(x=>x.id===c)?.branch_id===b))){setError('Elige por lo menos una cabina para cada sucursal seleccionada.');return;}
  setSaving(true);const suffix=Math.random().toString(36).slice(2,7);const {data:newTreatment,error:te}=await supabase.from('treatments').insert({name:name.trim(),slug:`${slugify(name)}-${suffix}`,category_id:categoryId||null,short_description:description.trim(),description:description.trim(),image_url:imageUrl.trim()||null,base_price:Number(price),default_duration_minutes:Number(duration),default_session_count:Number(sessions),recommended_interval_days:interval?Number(interval):null,is_featured:featured,is_active:true}).select('id').single();
  if(te||!newTreatment){setError(te?.message??'No se pudo crear.');setSaving(false);return;}
  const {error:be}=await supabase.from('treatment_branches').insert(chosenBranches.map(branch_id=>({treatment_id:newTreatment.id,branch_id,is_active:true})));
  if(be){setError(`Se creó el tratamiento pero faltó habilitar sus sucursales: ${be.message}`);setSaving(false);await load();return;}
  const selected=cabins.filter(c=>chosenBranches.includes(c.branch_id)&&chosenCabins.includes(c.id));
  const {error:ce}=await supabase.from('treatment_cabins').insert(selected.map(c=>({treatment_id:newTreatment.id,branch_id:c.branch_id,cabin_id:c.id})));
  setSaving(false);if(ce){setError(`Se creó el tratamiento, pero hay que completar sus cabinas: ${ce.message}`);await load();return;}
  setSuccess('Tratamiento publicado. Ya aparece en el catálogo de clientes.');setName('');setDescription('');setImageUrl('');setChosenBranches([]);setChosenCabins([]);await load();}
 return <section className="page-stack"><div className="page-heading"><p className="eyebrow">Catálogo</p><h2>Tratamientos</h2><p className="muted">Crea tratamientos reales, define sesiones y habilita las cabinas donde pueden realizarse. Publicar requiere superadmin.</p></div>
 {error&&<div className="alert error-alert" role="alert">{error}</div>}{success&&<div className="alert" role="status">{success}</div>}
 <form onSubmit={create} className="panel-card" style={{display:'grid',gap:12,maxWidth:760}}><h3>+ Nuevo tratamiento</h3>
 <label>Nombre<br/><input required maxLength={140} value={name} onChange={e=>setName(e.target.value)}/></label><label>Descripción<br/><textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><label>URL de imagen (opcional)<br/><input type="url" value={imageUrl} placeholder="https://..." onChange={e=>setImageUrl(e.target.value)}/></label>
 <label>Categoría<br/><select value={categoryId} onChange={e=>setCategoryId(e.target.value)}><option value="">Sin categoría</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
 <label>Precio base (MXN)<br/><input type="number" min="0" step="0.01" required value={price} onChange={e=>setPrice(e.target.value)}/></label>
 <label>Duración de cada sesión (minutos)<br/><input type="number" min="1" max="600" required value={duration} onChange={e=>setDuration(e.target.value)}/></label>
 <label>Número predeterminado de sesiones<br/><input type="number" min="1" max="200" required value={sessions} onChange={e=>setSessions(e.target.value)}/></label>
 <label>Intervalo recomendado (días, opcional)<br/><input type="number" min="0" value={interval} onChange={e=>setInterval(e.target.value)}/></label><label><input type="checkbox" checked={featured} onChange={e=>setFeatured(e.target.checked)}/> Mostrar como destacado</label>
 <h4>Sucursales disponibles</h4>{branches.map(b=><label key={b.id}><input type="checkbox" checked={chosenBranches.includes(b.id)} onChange={e=>{setChosenBranches(old=>e.target.checked?[...old,b.id]:old.filter(id=>id!==b.id));if(!e.target.checked)setChosenCabins(old=>old.filter(id=>cabins.find(c=>c.id===id)?.branch_id!==b.id));}}/> {b.name}</label>)}
 <h4>Cabinas compatibles</h4>{cabins.filter(c=>chosenBranches.includes(c.branch_id)).map(c=><label key={c.id}><input type="checkbox" checked={chosenCabins.includes(c.id)} onChange={e=>setChosenCabins(old=>e.target.checked?[...old,c.id]:old.filter(id=>id!==c.id))}/> {branches.find(b=>b.id===c.branch_id)?.name} · {c.name}</label>)}
 <button disabled={saving||loading} type="submit">{saving?'Guardando…':'Crear tratamiento'}</button></form>
 <div className="section-title"><h2>Tratamientos existentes</h2></div>{loading?<div className="fullscreen-inline"><div className="spinner"/></div>:treatments.length?<div className="card-grid three-cols">{treatments.map(t=><article className="panel-card" key={t.id}><span className="mini-pill">{t.is_active?'Activo':'Inactivo'}</span>{t.is_featured&&<span className="mini-pill">Destacado</span>}<h3>{t.name}</h3><p className="muted">{t.short_description||'Sin descripción'}</p><p>{t.default_duration_minutes} min · {t.default_session_count} sesiones · {formatMoney(Number(t.base_price))}</p></article>)}</div>:<div className="empty-state"><strong>Todavía no hay tratamientos creados.</strong></div>}
 </section>;
}
