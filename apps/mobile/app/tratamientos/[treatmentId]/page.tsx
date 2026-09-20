'use client';
import {useParams} from 'next/navigation';import Link from 'next/link';
import {MobileShell} from '@/components/MobileShell';import {useClient} from '@/components/ClientProvider';
import {currency,whatsappHref} from '@/lib/client-data';
export default function TreatmentDetail(){const {treatmentId}=useParams<{treatmentId:string}>();const {data}=useClient();const t=data?.treatments.find(t=>t.id===treatmentId);
 if(!data)return <MobileShell title="Tratamiento"><div className="empty-card">Cargando…</div></MobileShell>;
 if(!t)return <MobileShell title="Tratamiento"><div className="empty-card">No encontramos este tratamiento.</div><Link href="/tratamientos" className="secondary-button">Volver al catálogo</Link></MobileShell>;
 const phone=data.branches.find(b=>b.id===data.profile?.preferred_branch_id)?.phone;
 const whatsapp=whatsappHref(t.name,phone);
 const assigned=data.plans.find(p=>p.treatment_id===t.id&&['active','paused'].includes(p.status));
 return <MobileShell title="Tratamiento"><Link href="/tratamientos" className="muted-link">← Todos los tratamientos</Link>
 {t.image_url?<img className="treatment-photo detail" src={t.image_url} alt={t.name}/>:<div className="detail-image">HAUT</div>}
 <h2 className="detail-title">{t.name}</h2><div className="meta-row">{t.catalog_details_pending ? <span>Sesiones, duración y precio por confirmar con Haut</span> : <><span>{t.default_session_count} {t.default_session_count===1?'sesión':'sesiones'}</span><span>·</span><span>{t.default_duration_minutes} min por sesión</span><span>·</span><span>Desde {currency(t.base_price)}</span></>}</div>
 <p className="subtle">{t.description||t.short_description||'Consulta con Haut Clinical para conocer más sobre este tratamiento.'}</p>
 {t.recommendations&&<><div className="divider"/><h3>Recomendaciones</h3><p className="subtle">{t.recommendations}</p></>}
 {t.contraindications&&<><h3>Consideraciones</h3><p className="subtle">{t.contraindications}</p></>}
 <div className="divider"/><h3>Sucursales disponibles</h3><p className="subtle">Consulta directamente con Haut la disponibilidad en tu sucursal.</p>
 <div className="action-stack">{whatsapp?<a className="primary-button" target="_blank" rel="noopener noreferrer" href={whatsapp}>Solicitar información por WhatsApp ↗</a>:<div className="empty-card">Haut todavía no ha configurado un número de WhatsApp para consultas.</div>}{assigned&&<Link className="secondary-button" href={`/mis-tratamientos/${assigned.id}`}>Ver mi tratamiento asignado</Link>}</div>
 <p className="small-print">Las citas se agendan por el personal de Haut Clinical.</p>
 </MobileShell>;
}
