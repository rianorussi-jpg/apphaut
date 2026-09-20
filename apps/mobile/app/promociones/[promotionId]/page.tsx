'use client';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {MobileShell} from '@/components/MobileShell';
import {BackLink} from '@/components/BackLink';
import {Icon} from '@/components/Icon';
import {useClient} from '@/components/ClientProvider';

export default function PromotionDetailPage(){
  const params=useParams<{promotionId:string}>();
  const {data}=useClient();
  const promotion=data?.promotions.find(item=>item.id===params.promotionId);
  return <MobileShell title="Promoción" eyebrow="BENEFICIOS · HAUT">
    <BackLink href="/promociones" label="Promociones"/>
    {!data?<div className="empty-card">Cargando promoción…</div>:!promotion?<div className="empty-feature"><h2>Esta promoción ya no está disponible.</h2><p>Consulta las promociones vigentes de HAUT.</p><Link href="/promociones" className="secondary-button">Ver promociones</Link></div>:<article className="promo-detail-page">
      {promotion.image_url?<img className="promo-detail-image" src={promotion.image_url} alt={promotion.title}/>:<div className="promo-detail-no-image"><Icon name="sparkles" size={32}/></div>}
      <div className="promo-detail-copy"><span className="eyebrow">PROMOCIÓN · HAUT CLINICAL</span><h2>{promotion.title}</h2>{promotion.description&&<p>{promotion.description}</p>}{promotion.treatment_id&&<Link className="primary-button" href={`/tratamientos/${promotion.treatment_id}`}>Conocer el tratamiento <Icon name="arrow" size={17}/></Link>}</div>
    </article>}
  </MobileShell>;
}
