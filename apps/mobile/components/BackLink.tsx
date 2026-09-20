import Link from 'next/link';
import {Icon} from './Icon';
export function BackLink({href,label}:{href:string;label:string}){return <Link href={href} className="back-link" aria-label={`Volver a ${label}`}><span className="back-link-circle"><Icon name="back" size={18}/></span><span>{label}</span></Link>}
