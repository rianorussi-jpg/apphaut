import Link from 'next/link';
import type {Treatment} from '@/lib/types';
import {currency} from '@/lib/client-data';
import {Icon} from './Icon';

export function TreatmentTile({treatment}:{treatment:Treatment}){
 return <Link href={`/tratamientos/${treatment.id}`} className={`treatment-card ${treatment.is_package?'package-card':''}`}>
  <div className="tile-photo-wrap">
   {treatment.image_url?<img className="treatment-photo" src={treatment.image_url} alt={treatment.name} loading="lazy"/>:<div className="image-placeholder"><Icon name="image" size={28}/><small>Imagen próximamente</small></div>}
   {treatment.is_package?<span className="tile-featured">Paquete HAUT</span>:treatment.is_featured&&<span className="tile-featured"><Icon name="star" size={12}/> Favorito</span>}
   {treatment.is_sold_in_app&&<span className="tile-sale-badge">Compra disponible</span>}
  </div>
  <div className="body"><span className="tile-eyebrow">HAUT · {treatment.is_package?'PAQUETE':'TRATAMIENTO'}</span><h3>{treatment.name}</h3><p>{treatment.is_sold_in_app&&treatment.purchase_session_count&&treatment.purchase_duration_minutes?`${treatment.purchase_session_count} ${treatment.purchase_session_count===1?'sesión incluida':'sesiones incluidas'} · ${treatment.purchase_duration_minutes} min`:treatment.catalog_details_pending?'Consulta los detalles con Haut':`${treatment.default_session_count} ${treatment.default_session_count===1?'sesión':'sesiones'} · ${treatment.default_duration_minutes} min · Puede variar`}</p><div className="tile-footer"><strong>{treatment.is_sold_in_app?currency(treatment.base_price):treatment.catalog_details_pending?'Solicitar información':currency(treatment.base_price)}</strong><span className="tile-arrow"><Icon name="arrow" size={17}/></span></div></div>
 </Link>;
}
