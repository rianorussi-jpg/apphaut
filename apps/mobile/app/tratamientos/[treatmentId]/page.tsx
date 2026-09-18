import Link from 'next/link';
import { MobileShell } from '@/components/MobileShell';

export default async function TreatmentDetail({params}:{params:Promise<{treatmentId:string}>}){
  const { treatmentId }=await params;
  const multi=treatmentId!=='hydrafacial' && treatmentId!=='facial-premium';
  const name=treatmentId==='hydrafacial'?'Hydrafacial':treatmentId==='depilacion'?'Depilación':treatmentId==='facial-premium'?'Facial Premium':'Tratamiento corporal X';
  return <MobileShell title="Detalle">
    <div className="detail-image">HAUT</div>
    <h2 className="detail-title">{name}</h2>
    <div className="meta-row"><span>{multi?'6 sesiones':'1 sesión'}</span><span>•</span><span>{multi?'60':'60'} min</span><span>•</span><span>Desde $—</span></div>
    <p className="subtle">Descripción del tratamiento, beneficios, recomendaciones y contraindicaciones se cargarán desde Supabase cuando conectemos el catálogo real.</p>
    <div className="divider"/>
    <h3>Disponible en</h3><p className="subtle">Juriquilla · y las sucursales configuradas para el tratamiento.</p>
    <div className="action-stack"><Link className="primary-button" href={`/reservar/${treatmentId}`}>Reservar cita</Link></div>
  </MobileShell>
}
