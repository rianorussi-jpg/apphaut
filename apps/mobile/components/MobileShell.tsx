'use client';
import Link from 'next/link';
import {useState} from 'react';
import {BottomNav} from './BottomNav';
import {Icon} from './Icon';
import {useClient} from './ClientProvider';
import {welcomeCouponAvailable} from '@/lib/client-data';

export function MobileShell({children,title,eyebrow='HAUT · CLINICAL CENTER'}:{children:React.ReactNode;title?:string;eyebrow?:string}){
 const {data}=useClient();
 const [couponOpen,setCouponOpen]=useState(false);
 const hasCoupon=Boolean(data&&welcomeCouponAvailable(data));
 return <main className="phone-page"><div className="app-frame"><header className="mobile-header"><div className="mobile-heading"><p className="brand-kicker">{eyebrow}</p>{title&&<h1>{title}</h1>}</div><div className="header-brand-actions">{hasCoupon&&<button type="button" className="header-coupon-button" aria-label="Ver mi cupón de bienvenida" onClick={()=>setCouponOpen(true)}><Icon name="ticket" size={21}/><span>10%</span></button>}<Link href="/" className="header-brand-logo" aria-label="Ir al inicio"><img src="/logo.png" alt="HAUT Clinical Center"/></Link></div></header><div className="screen-content">{children}</div><BottomNav/>{couponOpen&&<div className="coupon-modal-backdrop" role="presentation" onClick={()=>setCouponOpen(false)}><section className="coupon-modal" role="dialog" aria-modal="true" aria-labelledby="welcome-coupon-title" onClick={event=>event.stopPropagation()}><button type="button" className="coupon-modal-close" aria-label="Cerrar" onClick={()=>setCouponOpen(false)}>×</button><div className="coupon-modal-icon"><Icon name="ticket" size={30}/><strong>10%</strong></div><span className="eyebrow">CUPÓN DE BIENVENIDA</span><h2 id="welcome-coupon-title">Un beneficio por descargar HAUT</h2><p>Tienes un cupón del <strong>10% de descuento</strong> por descargar la app. Se aplicará en tu primera compra.</p><button type="button" className="primary-button" onClick={()=>setCouponOpen(false)}>Entendido</button></section></div>}</div></main>;
}
