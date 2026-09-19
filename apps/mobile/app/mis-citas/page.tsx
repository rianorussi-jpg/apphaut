'use client';
import {useState} from 'react';import {MobileShell} from '@/components/MobileShell';import {useClient} from '@/components/ClientProvider';import {AppointmentCard} from '@/components/AppointmentCard';
import {activeAppointment} from '@/lib/client-data';
export default function Appointments(){const {data}=useClient();const [tab,setTab]=useState<'next'|'history'>('next');const now=Date.now();
 const appts=data?.appointments.filter(a=>tab==='next'?activeAppointment(a)&&new Date(a.ends_at).getTime()>=now:!activeAppointment(a)||new Date(a.ends_at).getTime()<now).sort((a,b)=>tab==='next'?a.starts_at.localeCompare(b.starts_at):b.starts_at.localeCompare(a.starts_at))??[];
 return <MobileShell title="Mis citas"><p className="subtle">Tus próximas citas y reservas anteriores, organizadas por fecha.</p><div className="tab-buttons"><button className={tab==='next'?'active':''} onClick={()=>setTab('next')}>Próximas</button><button className={tab==='history'?'active':''} onClick={()=>setTab('history')}>Historial</button></div>{appts.length&&data?appts.map(a=><AppointmentCard key={a.id} a={a} d={data}/>):<div className="empty-card">{tab==='next'?'Todavía no tienes próximas citas. Haut las agendará desde recepción.':'Aún no hay citas anteriores.'}</div>}</MobileShell>;
}
