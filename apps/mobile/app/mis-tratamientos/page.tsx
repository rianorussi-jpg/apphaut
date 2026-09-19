'use client';
import {useState} from 'react';import {MobileShell} from '@/components/MobileShell';import {useClient} from '@/components/ClientProvider';import {PlanCard} from '@/components/PlanCard';
export default function MyTreatments(){const {data}=useClient();const [tab,setTab]=useState<'active'|'completed'>('active');const plans=data?.plans.filter(p=>tab==='active'?['active','paused'].includes(p.status):['completed','cancelled'].includes(p.status))??[];
 return <MobileShell title="Mis tratamientos"><p className="subtle">Consulta las sesiones que Haut te ha asignado y tu progreso.</p><div className="tab-buttons"><button className={tab==='active'?'active':''} onClick={()=>setTab('active')}>Activos</button><button className={tab==='completed'?'active':''} onClick={()=>setTab('completed')}>Finalizados</button></div>
 {plans.length&&data?plans.map(p=><PlanCard key={p.id} plan={p} d={data}/>):<div className="empty-card">{tab==='active'?'Aún no tienes tratamientos activos. Aparecerán cuando Haut te asigne uno.':'No tienes tratamientos finalizados por el momento.'}</div>}
 </MobileShell>;
}
