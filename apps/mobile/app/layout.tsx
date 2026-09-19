import type { Metadata, Viewport } from 'next';
import {ClientProvider} from '@/components/ClientProvider';
import './globals.css';
export const metadata: Metadata = {title:'Haut Clinical',description:'Tratamientos, citas y beneficios para clientes de Haut Clinical'};
export const viewport: Viewport = {width:'device-width',initialScale:1,viewportFit:'cover'};
export default function RootLayout({children}:{children:React.ReactNode}){
 return <html lang="es"><body><ClientProvider>{children}</ClientProvider></body></html>;
}
