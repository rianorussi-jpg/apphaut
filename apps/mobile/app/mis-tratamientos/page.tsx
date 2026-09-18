import Link from 'next/link';
import { MobileShell } from '@/components/MobileShell';
export default function MyTreatments(){return <MobileShell title="Mis tratamientos">
  <div className="tabs"><a className="active">Activos</a><a>Finalizados</a></div>
  <Link className="card" style={{display:'block'}} href="/mis-tratamientos/demo">
    <h3>Tratamiento corporal X</h3><p>2 de 6 sesiones completadas</p>
    <div className="progress-row">{[1,2,3,4,5,6].map(i=><span key={i} className={`dot ${i<=2?'done':''}`}/>)}</div>
    <p><strong>Próxima:</strong> 24 Sep · 4:00 PM</p><span className="status">En progreso</span>
  </Link>
  <article className="card"><h3>Depilación</h3><p>1 de 6 sesiones completadas</p><div className="progress-row">{[1,2,3,4,5,6].map(i=><span key={i} className={`dot ${i<=1?'done':''}`}/>)}</div><p>Siguiente sesión disponible</p><Link className="secondary-button" href="/reservar/depilacion">Reservar siguiente sesión</Link></article>
</MobileShell>}
