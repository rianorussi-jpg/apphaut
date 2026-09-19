'use client';
import { BottomNav } from './BottomNav';
import {useClient} from './ClientProvider';
export function MobileShell({ children, title, eyebrow='HAUT CLINICAL' }: { children:React.ReactNode;title?:string;eyebrow?:string}){
 const {data}=useClient();
 return <main className="phone-page"><div className="app-frame"><header className="mobile-header"><div><p className="brand-kicker">{eyebrow}</p>{title&&<h1>{title}</h1>}</div><div className="mini-avatar" aria-label="Cuenta">{(data?.profile?.full_name||'H').charAt(0).toUpperCase()}</div></header><div className="screen-content">{children}</div><BottomNav/></div></main>;
}
