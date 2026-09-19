import Link from 'next/link';
import type {ClientData,Plan} from '@/lib/types';
import {completedCount,dateLabel,treatmentFor,upcomingForPlan,statusLabel} from '@/lib/client-data';
export function PlanCard({plan,d}:{plan:Plan;d:ClientData}){
 const completed=completedCount(d,plan);const upcoming=upcomingForPlan(d,plan);const t=treatmentFor(d,plan);
 return <article className="card"><h3>{t?.name??'Tratamiento'}</h3><p>{completed} de {plan.total_sessions} sesiones completadas</p>
 <div className="progress-track"><div className="progress-fill" style={{width:`${Math.min(100,completed/plan.total_sessions*100)}%`}}/></div>
 {upcoming?<p>Próxima cita: {dateLabel(upcoming.starts_at)}</p>:<p>{completed===plan.total_sessions?'Todas las sesiones finalizadas':plan.status==='active'?'Consulta con Haut para agendar tu siguiente sesión.':statusLabel(plan.status)}</p>}
 <div className="card-actions"><Link href={`/mis-tratamientos/${plan.id}`} className="secondary-button">Ver tratamiento</Link>{upcoming&&<Link href={`/mis-citas/${upcoming.id}`} className="muted-link">Ver próxima cita →</Link>}</div></article>
}
