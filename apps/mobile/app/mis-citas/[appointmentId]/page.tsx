'use client';
import {useParams} from 'next/navigation';import Link from 'next/link';
import {MobileShell} from '@/components/MobileShell';import {useClient} from '@/components/ClientProvider';
import {dateLabel,googleReviewHref,planFor,sessionFor,statusLabel,treatmentFor} from '@/lib/client-data';
import {BackLink} from '@/components/BackLink';import {Icon} from '@/components/Icon';

function whatsappPhone(raw?:string|null){
 let phone=(raw||'').replace(/\D/g,'');
 if(phone.length===10)phone=`52${phone}`;
 return phone.length>=10&&phone.length<=15?phone:null;
}
function icsUtc(value:string){return new Date(value).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z')}
function icsText(value:string){return value.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;')}

export default function AppointmentDetail(){const {appointmentId}=useParams<{appointmentId:string}>();const {data}=useClient();const a=data?.appointments.find(a=>a.id===appointmentId);
 if(!data||!a)return <MobileShell title="Detalle de cita"><BackLink href="/mis-citas" label="Mis citas"/><div className="empty-card">{data?'No encontramos esta cita.':'Cargando…'}</div></MobileShell>;
 const plan=planFor(data,a);const session=sessionFor(data,a);const t=plan?treatmentFor(data,plan):null;const branch=data.branches.find(b=>b.id===a.branch_id);
 const upcoming=['pending','confirmed','arrived'].includes(a.status)&&new Date(a.ends_at).getTime()>=Date.now();
 const completed=a.status==='completed';
 const reviewHref=branch?googleReviewHref(branch):null;
 const phone=whatsappPhone(branch?.phone);
 const messageHref=phone?`https://wa.me/${phone}?text=${encodeURIComponent(`Hola, me gustaría comunicarme con el equipo de HAUT sobre mi cita de ${t?.name||'tratamiento'} del ${dateLabel(a.starts_at,true)} en HAUT ${branch?.name||'Sucursal'}. ¿Me pueden ayudar?`)}`:null;
 function addToCalendar(){
  const title=`HAUT · ${t?.name||'Cita'}`;
  const location=[`HAUT ${branch?.name||'Sucursal'}`,branch?.address].filter(Boolean).join(', ');
  const description=plan&&plan.total_sessions>1?`${t?.name||'Tratamiento'} · Sesión ${session?.session_number||''} de ${plan.total_sessions}`:`Cita de ${t?.name||'tratamiento'} en HAUT`;
  const ics=[
   'BEGIN:VCALENDAR','VERSION:2.0','CALSCALE:GREGORIAN','METHOD:PUBLISH','PRODID:-//HAUT Clinical//Citas//ES',
   'BEGIN:VEVENT',`UID:${a.id}@haut-clinical`,`DTSTAMP:${icsUtc(new Date().toISOString())}`,`DTSTART:${icsUtc(a.starts_at)}`,`DTEND:${icsUtc(a.ends_at)}`,`SUMMARY:${icsText(title)}`,`LOCATION:${icsText(location)}`,`DESCRIPTION:${icsText(description)}`,'END:VEVENT','END:VCALENDAR'
  ].join('\r\n');
  const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`cita-haut-${a.id}.ics`;document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <MobileShell title="Detalle de cita" eyebrow="TU AGENDA · HAUT"><BackLink href="/mis-citas" label="Mis citas"/><section className="appointment-detail-hero"><span className={`status status-${a.status}`}>{statusLabel(a.status)}</span><span className="eyebrow">TU VISITA A HAUT</span><h2>{t?.name||'Tratamiento'}</h2>{plan&&plan.total_sessions>1&&<p>Sesión {session?.session_number} de {plan.total_sessions}</p>}</section><div className="appointment-detail-card"><div className="appointment-detail-row"><span><Icon name="calendar" size={21}/></span><div><small>FECHA Y HORA</small><strong>{dateLabel(a.starts_at,true)}</strong><p>Hasta {dateLabel(a.ends_at)}</p>{upcoming&&<button type="button" className="appointment-inline-action" onClick={addToCalendar}><Icon name="calendar" size={16}/> Agregar al calendario</button>}</div></div><div className="appointment-detail-row"><span><Icon name="pin" size={21}/></span><div><small>SUCURSAL</small><strong>Haut {branch?.name||'Sucursal'}</strong>{branch?.address&&<p>{branch.address}</p>}</div></div></div>{upcoming&&<div className="detail-information detail-information-contact"><Icon name="info" size={20}/><div><p>Para cambiar o cancelar esta visita, comunícate con el equipo de HAUT. La programación se realiza desde recepción.</p>{messageHref?<a className="secondary-button appointment-message-button" href={messageHref} target="_blank" rel="noopener noreferrer"><Icon name="chat" size={17}/> Enviar mensaje</a>:<span className="appointment-contact-missing">WhatsApp de la sucursal no disponible.</span>}</div></div>}{completed&&reviewHref&&<div className="google-review-card"><span className="google-review-icon"><Icon name="star" size={22}/></span><div><span className="eyebrow">TU EXPERIENCIA CUENTA</span><h3>Regálanos una opinión en Google</h3><p>Tu reseña ayuda a otras personas a conocer HAUT {branch?.name||''} y nos ayuda a seguir mejorando.</p><a className="primary-button google-review-button" href={reviewHref} target="_blank" rel="noopener noreferrer"><Icon name="star" size={18}/> Escribir una reseña</a></div></div>}{plan&&plan.total_sessions>1&&<Link className="secondary-button detail-plan-link" href={`/mis-tratamientos/${plan.id}`}>Ver progreso de mi tratamiento <Icon name="arrow" size={17}/></Link>}</MobileShell>;
}
