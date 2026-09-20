'use client';
import {useState} from 'react';
import Link from 'next/link';
import type {Promotion} from '@/lib/types';
import {Icon} from './Icon';
export function PromotionCarousel({promotions}:{promotions:Promotion[]}){
 const [index,setIndex]=useState(0);const length=promotions.length;
 if(!length)return <section className="promo-carousel promo-intro"><span className="promo-overline">TU ESPACIO HAUT</span><h2>Un momento para ti.</h2><p>Explora tus tratamientos, tus citas y los beneficios de tu cuenta.</p><Link href="/tratamientos" className="promo-cta">Descubrir tratamientos <Icon name="arrow" size={17}/></Link><div className="promo-orb" aria-hidden="true"/></section>;
 const offer=promotions[Math.min(index,length-1)];const href=offer.treatment_id?`/tratamientos/${offer.treatment_id}`:'/promociones';
 return <section className="promo-carousel" aria-roledescription="carrusel" aria-label="Promociones de Haut"><div className="promo-backdrop" style={offer.image_url?{backgroundImage:`linear-gradient(90deg,rgba(37,33,27,.88),rgba(37,33,27,.2)), url("${offer.image_url.replaceAll('"','%22')}")`}:undefined}/><div className="promo-inner"><span className="promo-overline">EXCLUSIVO EN HAUT · {String(index+1).padStart(2,'0')}/{String(length).padStart(2,'0')}</span><h2>{offer.title}</h2>{offer.description&&<p>{offer.description}</p>}<Link href={href} className="promo-cta">{offer.treatment_id?'Conocer tratamiento':'Ver promociones'} <Icon name="arrow" size={17}/></Link></div>{length>1&&<div className="promo-controls"><button type="button" aria-label="Promoción anterior" onClick={()=>setIndex(i=>(i-1+length)%length)}><Icon name="back" size={18}/></button><div className="promo-dots">{promotions.map((p,i)=><button key={p.id} type="button" className={i===index?'selected':''} aria-label={`Ver promoción ${i+1}`} aria-current={i===index?'true':undefined} onClick={()=>setIndex(i)}/>)}</div><button type="button" aria-label="Promoción siguiente" onClick={()=>setIndex(i=>(i+1)%length)}><Icon name="forward" size={18}/></button></div>}</section>
}
