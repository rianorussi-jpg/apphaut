import Link from 'next/link';
import { MobileShell } from '@/components/MobileShell';
export default function Appointments(){return <MobileShell title="Mis citas">
  <div className="tabs"><a className="active">Próximas</a><a>Historial</a></div>
  <Link href="/mis-citas/demo" className="card appointment-card">
    <div className="date-block"><span>SEP</span><strong>24</strong><span>4:00 PM</span></div>
    <div><h3>Tratamiento corporal</h3><p>Sesión 3 de 6</p><p>Haut Juriquilla</p><span className="status">Confirmada</span></div>
  </Link>
  <article className="card appointment-card"><div className="date-block"><span>SEP</span><strong>28</strong><span>11:00 AM</span></div><div><h3>Hydrafacial</h3><p>Haut Juriquilla</p><span className="status">Confirmada</span></div></article>
</MobileShell>}
