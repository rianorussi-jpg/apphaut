'use client';
import Link from 'next/link';
import {MobileShell} from '@/components/MobileShell';
import {useClient} from '@/components/ClientProvider';
import {activeAppointment,dateLabel,planFor,sessionFor,treatmentFor,pointsBalance} from '@/lib/client-data';
import {PlanCard} from '@/components/PlanCard';
import {TreatmentTile} from '@/components/TreatmentTile';
export default function HomePage(){const {data}=useClient();
 if(!data)return <MobileShell title="Inicio"><div className="empty-card">Cargando tus datos…</div></MobileShell>;
 const next=data.appointments.filter(a=>activeAppointment(a)&&new Date(a.ends_at).getTime()>=Date.now()).sort((a,b)=>a.starts_at.localeCompare(b.starts_at))[0];
 const nextPlan=next?planFor(data,next):null;const nextTreatment=nextPlan?treatmentFor(data,nextPlan):null;
 const activePlans=data.plans.filter(p=>p.status==='active'||p.status==='paused');
 return <MobileShell title={`Hola, ${(data.profile?.full_name||'').split(' ')[0]||'bienvenida'}`}>
  <section className="hero-card"><span className="eyebrow">Tu próxima cita</span>
   {next?<><h2>{nextTreatment?.name??'Tratamiento'}</h2><p>{dateLabel(next.starts_at,true)}<br/>Haut {data.branches.find(b=>b.id===next.branch_id)?.name??'Sucursal'}{nextPlan&&nextPlan.total_sessions>1&&` · Sesión ${sessionFor(data,next)?.session_number} de ${nextPlan.total_sessions}`}</p><Link className="primary-button" href={`/mis-citas/${next.id}`}>Ver cita</Link></>:<><h2>Tu bienestar comienza aquí</h2><p>Cuando Haut agende una cita para ti, aparecerá en este espacio.</p></>}
  </section>
  <div className="section-title"><h2>Mis tratamientos</h2><Link href="/mis-tratamientos">Ver todos</Link></div>
  {activePlans.length?activePlans.slice(0,2).map(p=><PlanCard key={p.id} d={data} plan={p}/>):<div className="empty-card">Aún no tienes tratamientos asignados. Haut los agregará desde administración.</div>}
  <div className="section-title"><h2>Mis rewards</h2><Link href="/rewards">Ver puntos</Link></div><Link className="card block-link" href="/rewards"><p>Tu saldo disponible</p><div className="info-number">{pointsBalance(data)} <span style={{fontSize:14}}>puntos</span></div><span className="muted-link">Ver mis movimientos →</span></Link>
  <div className="section-title"><h2>Promociones</h2><Link href="/promociones">Ver todas</Link></div>
  {data.promotions.length?data.promotions.slice(0,2).map(p=><Link key={p.id} className="card block-link" href={p.treatment_id?`/tratamientos/${p.treatment_id}`:'/promociones'}><h3>{p.title}</h3><p>{p.description}</p></Link>):<div className="empty-card">Próximamente encontrarás promociones especiales aquí.</div>}
  <div className="section-title"><h2>Tratamientos destacados</h2><Link href="/tratamientos">Explorar</Link></div>
  {data.treatments.length?<div className="catalog-grid">{(data.treatments.filter(t=>t.is_featured).length?data.treatments.filter(t=>t.is_featured):data.treatments).slice(0,4).map(t=><TreatmentTile key={t.id} treatment={t}/>)}</div>:<div className="empty-card">Haut aún no ha cargado sus tratamientos.</div>}
 </MobileShell>;
}
