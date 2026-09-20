import Link from 'next/link';
import type {Appointment,ClientData} from '@/lib/types';
import {planFor,sessionFor,statusLabel,treatmentFor} from '@/lib/client-data';
import {Icon} from './Icon';
const locale='es-MX';
export function AppointmentCard({a,d}:{a:Appointment;d:ClientData}){
 const plan=planFor(d,a);const t=plan?treatmentFor(d,plan):null;const session=sessionFor(d,a);const branch=d.branches.find(b=>b.id===a.branch_id);const date=new Date(a.starts_at);
 const month=new Intl.DateTimeFormat(locale,{month:'short',timeZone:'America/Mexico_City'}).format(date).replace('.','').toUpperCase();
 const day=new Intl.DateTimeFormat(locale,{day:'2-digit',timeZone:'America/Mexico_City'}).format(date);
 const time=new Intl.DateTimeFormat(locale,{hour:'numeric',minute:'2-digit',hour12:true,timeZone:'America/Mexico_City'}).format(date);
 return <Link className="appointment-premium" href={`/mis-citas/${a.id}`}><div className="appointment-date"><span>{month}</span><strong>{day}</strong></div><div className="appointment-info"><div className="appointment-info-top"><span className="appointment-time-label"><Icon name="clock" size={14}/>{time}</span><span className={`status status-${a.status}`}>{statusLabel(a.status)}</span></div><h3>{t?.name??'Tratamiento'}</h3>{plan&&plan.total_sessions>1&&<p className="appointment-session">Sesión {session?.session_number} de {plan.total_sessions}</p>}<p className="appointment-location"><Icon name="pin" size={14}/> Haut {branch?.name??'Sucursal'}</p></div><Icon name="forward" size={17} className="appointment-go"/></Link>
}
