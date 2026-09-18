'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  ['/', 'Inicio', '⌂'],
  ['/tratamientos', 'Tratamientos', '◇'],
  ['/mis-tratamientos', 'Mis tratamientos', '◫'],
  ['/mis-citas', 'Mis citas', '◷'],
  ['/perfil', 'Perfil', '○'],
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Navegación principal">
      {items.map(([href, label, icon]) => {
        const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
        return <Link key={href} href={href} className={active ? 'active' : ''}><span className="nav-icon">{icon}</span><span>{label}</span></Link>;
      })}
    </nav>
  );
}
