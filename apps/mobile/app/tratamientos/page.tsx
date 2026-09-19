'use client';
import {useMemo,useState} from 'react';
import {MobileShell} from '@/components/MobileShell';import {useClient} from '@/components/ClientProvider';import {TreatmentTile} from '@/components/TreatmentTile';
export default function TreatmentsPage(){const {data}=useClient();const [category,setCategory]=useState('all');
 const items=useMemo(()=>data?.treatments.filter(t=>(category==='all'||category==='featured'&&t.is_featured||category===t.category_id))??[],[data,category]);
 return <MobileShell title="Tratamientos"><p className="subtle">Explora nuestro catálogo. Para más detalles puedes solicitar información por WhatsApp.</p>
 <div className="chips"><button onClick={()=>setCategory('all')} className={`chip ${category==='all'?'active':''}`}>Todos</button><button onClick={()=>setCategory('featured')} className={`chip ${category==='featured'?'active':''}`}>Favoritos</button>{data?.categories.map(c=><button key={c.id} className={`chip ${category===c.id?'active':''}`} onClick={()=>setCategory(c.id)}>{c.name}</button>)}</div>
 {items.length?<div className="catalog-grid">{items.map(t=><TreatmentTile key={t.id} treatment={t}/>)}</div>:<div className="empty-card">No hay tratamientos disponibles en esta categoría por el momento.</div>}
 </MobileShell>;
}
