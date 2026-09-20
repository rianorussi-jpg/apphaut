'use client';
import Link from 'next/link';
import {MobileShell} from '@/components/MobileShell';
import {useClient} from '@/components/ClientProvider';
import {activeAppointment,dateLabel,planFor,sessionFor,treatmentFor} from '@/lib/client-data';
import {PlanCard} from '@/components/PlanCard';
import {TreatmentTile} from '@/components/TreatmentTile';
import {PromotionCarousel} from '@/components/PromotionCarousel';
import {Icon} from '@/components/Icon';
export default function HomePage(){const {data}=useClient();
 if(!data)return <MobileShell title="Inicio"><div className="empty-card">Cargando tu experiencia Haut…</div></MobileShell>;
 const next=data.appointments.filter(a=>activeAppointment(a)&&new Date(a.ends_at).getTime()>=Date.now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))[0];
 const nextPlan=next?planFor(data,next):null;const nextTreatment=nextPlan?treatmentFor(data,nextPlan):null;
 const activePlans=data.plans.filter(p=>p.status==='active'||p.status==='paused');
 const featured=data.treatments.filter(t=>t.is_featured);
 return <MobileShell title={`Hola, ${(data.profile?.full_name||'').split(' ')[0]||'bienvenida'}`} eyebrow="TU EXPERIENCIA HAUT">
 <PromotionCarousel promotions={data.promotions}/>
 <div className="section-title"><div><small>TU SEGUIMIENTO</small><h2>Mis tratamientos</h2></div><Link href="/mis-tratamientos">Ver todos <Icon name="forward" size={15}/></Link></div>
 {activePlans.length?activePlans.slice(0,2).map(p=><PlanCard key={p.id} d={data} plan={p}/>):<div className="empty-feature compact"><h3>Un plan diseñado para ti.</h3><p>Tus tratamientos asignados por Haut aparecerán aquí junto con el avance de cada sesión.</p><Link className="text-cta" href="/tratamientos">Conocer tratamientos <Icon name="arrow" size={16}/></Link></div>}
 <div className="section-title"><div><small>AGENDA PERSONAL</small><h2>Tu próxima cita</h2></div><Link href="/mis-citas">Ver agenda <Icon name="forward" size={15}/></Link></div>
 {next?<Link href={`/mis-citas/${next.id}`} className="next-appointment-hero"><span className="next-appointment-icon"><Icon name="calendar" size={25}/></span><div><span className="eyebrow">PRÓXIMA VISITA · {nextPlan&&nextPlan.total_sessions>1?`SESIÓN ${sessionFor(data,next)?.session_number} DE ${nextPlan.total_sessions}`:'HAUT CLINICAL'}</span><h3>{nextTreatment?.name??'Tratamiento'}</h3><p><Icon name="clock" size={15}/> {dateLabel(next.starts_at,true)}</p><p><Icon name="pin" size={15}/> Haut {data.branches.find(b=>b.id===next.branch_id)?.name??'Sucursal'}</p></div><span className="next-appointment-arrow"><Icon name="arrow" size={19}/></span></Link>:<div className="empty-feature"><div className="empty-feature-icon"><Icon name="calendar" size={26}/></div><h3>Tu próxima visita, aquí.</h3><p>Cuando recepción programe una cita para ti, podrás consultar todos los detalles en este espacio.</p></div>}
 <div className="section-title"><div><small>SELECCIÓN HAUT</small><h2>Para descubrir</h2></div><Link href="/tratamientos">Catálogo <Icon name="forward" size={15}/></Link></div>
 {data.treatments.length?<div className="catalog-grid">{(featured.length?featured:data.treatments).slice(0,4).map(t=><TreatmentTile key={t.id} treatment={t}/>)}</div>:<div className="empty-card">El catálogo de tratamientos aparecerá aquí cuando Haut lo publique.</div>}
 </MobileShell>
}
