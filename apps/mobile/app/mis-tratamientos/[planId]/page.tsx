import Link from 'next/link';
import { MobileShell } from '@/components/MobileShell';
export default function PlanDetail(){return <MobileShell title="Mi tratamiento">
  <h2 className="detail-title">Tratamiento corporal X</h2><div className="meta-row"><span>2 / 6 sesiones</span><span>•</span><span>En progreso</span></div>
  <article className="card"><p>Inicio</p><h3>10 septiembre 2026</h3><p>Intervalo recomendado · 7 días</p></article>
  <div className="section-title"><h2>Próxima sesión</h2></div>
  <article className="card"><h3>24 septiembre · 4:00 PM</h3><p>Haut Juriquilla · Sesión 3 de 6</p><Link className="secondary-button" href="/mis-citas/demo">Ver próxima cita</Link></article>
  <div className="section-title"><h2>Sesiones</h2></div>
  {[['1','Finalizada','10 Sep'],['2','Finalizada','17 Sep'],['3','Próxima','24 Sep · 4:00 PM'],['4','Pendiente',''],['5','Pendiente',''],['6','Pendiente','']].map(([n,s,d],i)=><div className={`session ${i<2?'done':''}`} key={n}><div className="session-number">{i<2?'✓':n}</div><div><strong>Sesión {n} · {s}</strong><span>{d}</span></div></div>)}
</MobileShell>}
