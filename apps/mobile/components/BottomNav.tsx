'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {Icon,type IconName} from './Icon';
const items:{href:string;label:string;icon:IconName}[]=[
 {href:'/',label:'Inicio',icon:'home'},
 {href:'/tratamientos',label:'Tratamientos',icon:'sparkles'},
 {href:'/mis-tratamientos',label:'Mis tratamientos',icon:'layers'},
 {href:'/mis-citas',label:'Mis citas',icon:'calendar'},
 {href:'/perfil',label:'Perfil',icon:'user'}
];
export function BottomNav(){const pathname=usePathname();return <nav className="bottom-nav" aria-label="Navegación principal">{items.map(item=>{const active=item.href==='/'?pathname==='/':pathname.startsWith(item.href);return <Link key={item.href} href={item.href} aria-current={active?'page':undefined} className={active?'active':''}><span className="nav-icon"><Icon name={item.icon} size={21}/></span><span>{item.label}</span></Link>})}</nav>}
