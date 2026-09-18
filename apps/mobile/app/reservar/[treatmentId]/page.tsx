import Link from 'next/link';
import { MobileShell } from '@/components/MobileShell';
export default async function Booking({params}:{params:Promise<{treatmentId:string}>}){const {treatmentId}=await params;return <MobileShell title="Reservar cita">
  <div className="booking-step"><span className="active"/><span className="active"/><span/><span/></div>
  <p className="brand-kicker">TRATAMIENTO</p><h2 className="detail-title" style={{fontSize:30}}>{treatmentId==='hydrafacial'?'Hydrafacial':'Tratamiento corporal X'}</h2>
  <div className="section-title"><h2>1. Sucursal</h2></div><div className="option-list"><div className="option"><span>Haut Juriquilla</span><strong>✓</strong></div><div className="option"><span>Otra sucursal</span><span>›</span></div></div>
  <div className="section-title"><h2>2. Fecha</h2></div><div className="option"><span>24 septiembre 2026</span><span>›</span></div>
  <div className="section-title"><h2>3. Hora</h2></div><div className="time-grid">{['10:00','11:30','13:00','16:00','17:30','19:00'].map(t=><button key={t} className="time">{t}</button>)}</div>
  <div className="action-stack"><Link className="primary-button" href="/mis-citas/demo">Confirmar cita</Link></div>
  <p className="subtle">Este flujo no aparece como sección principal. Más adelante los horarios vendrán del motor real de disponibilidad en Supabase.</p>
</MobileShell>}
