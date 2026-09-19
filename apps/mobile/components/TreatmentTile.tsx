import Link from 'next/link';
import type {Treatment} from '@/lib/types';
import {currency} from '@/lib/client-data';
export function TreatmentTile({treatment}:{treatment:Treatment}){return <Link href={`/tratamientos/${treatment.id}`} className="treatment-card">
  {treatment.image_url?<img className="treatment-photo" src={treatment.image_url} alt={treatment.name}/>:<div className="image-placeholder">HAUT</div>}
  <div className="body"><h3>{treatment.name}</h3><p>{treatment.default_session_count} {treatment.default_session_count===1?'sesión':'sesiones'} · {treatment.default_duration_minutes} min</p><p>{currency(treatment.base_price)}</p></div>
 </Link>}
