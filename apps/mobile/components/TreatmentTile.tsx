import Link from 'next/link';
import type {Treatment} from '@/lib/types';
import {currency} from '@/lib/client-data';
import {Icon} from './Icon';
export function TreatmentTile({treatment}:{treatment:Treatment}){return <Link href={`/tratamientos/${treatment.id}`} className="treatment-card">
 <div className="tile-photo-wrap">{treatment.image_url?<img className="treatment-photo" src={treatment.image_url} alt={treatment.name} loading="lazy"/>:<div className="image-placeholder"><Icon name="image" size={28}/><small>Imagen próximamente</small></div>}{treatment.is_featured&&<span className="tile-featured"><Icon name="star" size={12}/> Favorito</span>}</div>
 <div className="body"><span className="tile-eyebrow">HAUT · TRATAMIENTO</span><h3>{treatment.name}</h3><p>{treatment.catalog_details_pending?'Consulta los detalles con Haut':`${treatment.default_session_count} ${treatment.default_session_count===1?'sesión':'sesiones'} · ${treatment.default_duration_minutes} min`}</p><div className="tile-footer"><strong>{treatment.catalog_details_pending?'Solicitar información':currency(treatment.base_price)}</strong><span className="tile-arrow"><Icon name="arrow" size={17}/></span></div></div>
 </Link>}
