'use client';
import Link from 'next/link';
import {BottomNav} from './BottomNav';
export function MobileShell({children,title,eyebrow='HAUT · CLINICAL CENTER'}:{children:React.ReactNode;title?:string;eyebrow?:string}){
 return <main className="phone-page"><div className="app-frame"><header className="mobile-header"><div className="mobile-heading"><p className="brand-kicker">{eyebrow}</p>{title&&<h1>{title}</h1>}</div><Link href="/" className="header-brand-logo" aria-label="Ir al inicio"><img src="/logo.png" alt="HAUT Clinical Center"/></Link></header><div className="screen-content">{children}</div><BottomNav/></div></main>;
}
