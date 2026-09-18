import Link from 'next/link';
import { MobileShell } from '@/components/MobileShell';

export default function HomePage() {
  return <MobileShell title="Hola, Mariana">
    <section className="hero-card">
      <span className="eyebrow">Tu próxima cita</span>
      <h2>Tratamiento corporal</h2>
      <p>24 septiembre · 4:00 PM<br/>Haut Juriquilla · Sesión 3 de 6</p>
      <Link className="primary-button" href="/mis-citas/demo">Ver cita</Link>
    </section>

    <div className="section-title"><h2>Mis tratamientos</h2><Link href="/mis-tratamientos">Ver todos</Link></div>
    <article className="card">
      <h3>Tratamiento corporal</h3>
      <p>2 de 6 sesiones completadas</p>
      <div className="progress-row">{[1,2,3,4,5,6].map(i=><span key={i} className={`dot ${i<=2?'done':''}`}/>)}</div>
      <p>Próxima sesión · 24 Sep · 4:00 PM</p>
    </article>

    <div className="section-title"><h2>Destacados</h2><Link href="/tratamientos">Explorar</Link></div>
    <div className="catalog-grid">
      <Link href="/tratamientos/hydrafacial" className="treatment-card"><div className="image-placeholder">H</div><div className="body"><h3>Hydrafacial</h3><p>60 min · 1 sesión</p></div></Link>
      <Link href="/tratamientos/corporal-x" className="treatment-card"><div className="image-placeholder">HC</div><div className="body"><h3>Corporal X</h3><p>60 min · 6 sesiones</p></div></Link>
    </div>
  </MobileShell>;
}
