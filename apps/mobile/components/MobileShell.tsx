'use client';
import Link from 'next/link';
import {BottomNav} from './BottomNav';
import {useClient} from './ClientProvider';
import {Icon} from './Icon';
export function MobileShell({children,title,eyebrow='HAUT · CLINICAL CENTER'}:{children:React.ReactNode;title?:string;eyebrow?:string}){
 const {data,refresh,loading}=useClient();
 return <main className="phone-page"><div className="app-frame"><header className="mobile-header"><div className="mobile-heading"><p className="brand-kicker">{eyebrow}</p>{title&&<h1>{title}</h1>}</div><div className="header-actions"><button type="button" title="Actualizar mis datos" aria-label="Actualizar mis datos" className="header-action" onClick={()=>void refresh()} disabled={loading}><Icon name="refresh" size={18}/></button><Link href="/perfil" className="mini-avatar" aria-label="Ir a mi perfil">{(data?.profile?.full_name||'H').charAt(0).toUpperCase()}</Link></div></header><div className="screen-content">{children}</div><BottomNav/></div></main>;
}
