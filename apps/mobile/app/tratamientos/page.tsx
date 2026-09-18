import Link from 'next/link';
import { MobileShell } from '@/components/MobileShell';

const items = [
  ['hydrafacial','Hydrafacial','Facial','60 min · 1 sesión'],
  ['corporal-x','Tratamiento corporal X','Corporal','60 min · 6 sesiones'],
  ['depilacion','Depilación','Depilación','45 min · 6 sesiones'],
  ['facial-premium','Facial Premium','Facial','75 min · 1 sesión'],
];
export default function TreatmentsPage(){return <MobileShell title="Tratamientos">
  <div className="chips"><span className="chip active">Todos</span><span className="chip">Favoritos</span><span className="chip">Faciales</span><span className="chip">Corporales</span><span className="chip">Depilación</span></div>
  <div className="catalog-grid">{items.map(([id,name,cat,meta])=><Link key={id} href={`/tratamientos/${id}`} className="treatment-card"><div className="image-placeholder">{name.slice(0,1)}</div><div className="body"><p>{cat}</p><h3>{name}</h3><p>{meta}</p></div></Link>)}</div>
</MobileShell>}
