import Link from 'next/link';
import type {Appointment,ClientData} from '@/lib/types';
import {dateLabel,planFor,sessionFor,statusLabel,treatmentFor} from '@/lib/client-data';
export function AppointmentCard({a,d}:{a:Appointment;d:ClientData}){
 const plan=planFor(d,a);const treatment=plan? treatmentFor(d,plan):null;const session=sessionFor(d,a);
 const branch=d.branches.find(b=>b.id===a.branch_id);
 return <Link className="card block-link" href={`/mis-citas/${a.id}`}>
  <p className="info-label">{dateLabel(a.starts_at,true)}</p><h3>{treatment?.name??'Tratamiento'}</h3>
  {plan&&plan.total_sessions>1&&<p>Sesión {session?.session_number} de {plan.total_sessions}</p>}
  <p>Haut {branch?.name??'Sucursal'}</p><span className="status">{statusLabel(a.status)}</span>
 </Link>
}
