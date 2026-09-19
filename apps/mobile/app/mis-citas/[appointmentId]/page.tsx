'use client';
import {useParams} from 'next/navigation';import Link from 'next/link';
import {MobileShell} from '@/components/MobileShell';import {useClient} from '@/components/ClientProvider';
import {dateLabel,planFor,sessionFor,statusLabel,treatmentFor} from '@/lib/client-data';
export default function AppointmentDetail(){const {appointmentId}=useParams<{appointmentId:string}>();const {data}=useClient();const a=data?.appointments.find(a=>a.id===appointmentId);
 if(!data||!a)return <MobileShell title="Detalle de cita"><div className="empty-card">{data?'No encontramos esta cita.':'Cargando…'}</div></MobileShell>;
 const plan=planFor(data,a);const session=sessionFor(data,a);const t=plan?treatmentFor(data,plan):null;const branch=data.branches.find(b=>b.id===a.branch_id);
 return <MobileShell title="Detalle de cita"><Link href="/mis-citas" className="muted-link">← Mis citas</Link><div className="spacer"/><span className="status">{statusLabel(a.status)}</span><div className="spacer"/><h2 className="detail-title">{t?.name||'Tratamiento'}</h2>
 {plan&&plan.total_sessions>1&&<p className="subtle">Sesión {session?.session_number} de {plan.total_sessions}</p>}
 <article className="card"><h3>{dateLabel(a.starts_at,true)}</h3><p>Hasta: {dateLabel(a.ends_at)}</p><div className="divider"/><p>Haut {branch?.name||'Sucursal'}</p>{branch?.address&&<p>{branch.address}</p>}</article>
 <p className="subtle">Para reagendar o cancelar, comunícate con Haut Clinical. No se pueden realizar reservas ni cambios desde esta app por el momento.</p>
 {plan&&plan.total_sessions>1&&<Link className="secondary-button" href={`/mis-tratamientos/${plan.id}`}>Ver mi tratamiento</Link>}
 </MobileShell>;
}
