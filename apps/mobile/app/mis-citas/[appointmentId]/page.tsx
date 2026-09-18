import Link from 'next/link';
import { MobileShell } from '@/components/MobileShell';
export default function AppointmentDetail(){return <MobileShell title="Detalle de cita">
  <span className="status">Confirmada</span><div className="spacer"/>
  <h2 className="detail-title">Tratamiento corporal</h2><p className="subtle">Sesión 3 de 6</p>
  <article className="card"><h3>24 septiembre 2026</h3><p>4:00 PM · 60 minutos</p><div className="divider"/><p>Haut Juriquilla</p></article>
  <div className="action-stack"><button className="primary-button">Reagendar cita</button><button className="secondary-button">Cancelar cita</button><Link className="secondary-button" href="/mis-tratamientos/demo">Ver mi tratamiento</Link></div>
</MobileShell>}
