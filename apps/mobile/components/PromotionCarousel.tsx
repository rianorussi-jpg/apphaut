'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {Promotion} from '@/lib/types';
import {Icon} from './Icon';

export function PromotionCarousel({promotions}:{promotions:Promotion[]}){
  const [index,setIndex]=useState(0);
  const length=promotions.length;
  useEffect(()=>{
    if(length<2||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    const interval=window.setInterval(()=>{
      if(document.visibilityState==='visible')setIndex(current=>(current+1)%length);
    },5000);
    return ()=>window.clearInterval(interval);
  },[length,index]);
  useEffect(()=>{if(index>=length&&length>0)setIndex(0);},[index,length]);
  if(!length)return <section className="promo-carousel promo-intro"><span className="promo-overline">TU ESPACIO HAUT</span><h2>Un momento para ti.</h2><p>Explora tus tratamientos, tus citas y los beneficios de tu cuenta.</p><Link href="/tratamientos" className="promo-cta">Descubrir tratamientos <Icon name="arrow" size={17}/></Link><div className="promo-orb" aria-hidden="true"/></section>;
  const offer=promotions[Math.min(index,length-1)];
  return <section className="promo-carousel promo-photo-carousel" aria-roledescription="carrusel" aria-label="Promociones de Haut">
    <div className="promo-photo-stage">
      {offer.image_url?<img key={offer.id} className="promo-full-image" src={offer.image_url} alt={`Imagen de la promoción: ${offer.title}`} loading={index===0?'eager':'lazy'}/>:<div className="promo-photo-empty"><Icon name="image" size={32}/><span>Promoción HAUT</span></div>}
      {length>1&&<><button type="button" className="promo-photo-arrow previous" aria-label="Promoción anterior" onClick={()=>setIndex(i=>(i-1+length)%length)}><Icon name="back" size={20}/></button><button type="button" className="promo-photo-arrow next" aria-label="Promoción siguiente" onClick={()=>setIndex(i=>(i+1)%length)}><Icon name="forward" size={20}/></button></>}
      {length>1&&<div className="promo-photo-dots" aria-label="Seleccionar promoción">{promotions.map((p,i)=><button key={p.id} type="button" className={i===index?'selected':''} aria-label={`Ver promoción ${i+1} de ${length}`} aria-current={i===index?'true':undefined} onClick={()=>setIndex(i)}/>)}</div>}
      <Link href={`/promociones/${offer.id}`} className="promo-view-button">Ver promoción <Icon name="arrow" size={17}/></Link>
    </div>
  </section>;
}
