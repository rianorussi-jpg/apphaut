"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {Icon,type IconName} from './Icon';

const navigation: {href:string;label:string;icon:IconName}[] = [
  { href: '/dashboard', label: 'Inicio', icon: 'home' },
  { href: '/agenda', label: 'Agenda', icon: 'calendar' },
  { href: '/citas', label: 'Citas', icon: 'clock' },
  { href: '/clientes', label: 'Clientes', icon: 'user' },
  { href: '/promociones', label: 'Promociones', icon: 'gift' },
  { href: '/tratamientos', label: 'Tratamientos', icon: 'sparkles' },
  { href: '/sucursales', label: 'Sucursales y cabinas', icon: 'pin' },
  { href: '/horarios', label: 'Horarios y bloqueos', icon: 'sliders' },
  { href: '/usuarios', label: 'Usuarios y permisos', icon: 'shield' },
  { href: '/configuracion', label: 'Configuración', icon: 'sliders' },
];

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/agenda': 'Agenda',
  '/citas': 'Citas',
  '/clientes': 'Clientes',
  '/promociones': 'Promociones',
  '/tratamientos': 'Tratamientos',
  '/sucursales': 'Sucursales y cabinas',
  '/horarios': 'Horarios y bloqueos',
  '/usuarios': 'Usuarios y permisos',
  '/configuracion': 'Configuración',
};

type StaffState = {
  name: string;
  email: string;
  role: 'superadmin' | 'branch_admin' | 'reception';
};

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [staff, setStaff] = useState<StaffState | null>(null);
  const [checking, setChecking] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  const sectionTitle = useMemo(() => {
    const base = '/' + (pathname.split('/')[1] || 'dashboard');
    return titles[base] ?? 'Administración';
  }, [pathname]);

  useEffect(() => {
    let mounted = true;
    async function verify() {
      if (!supabase) {
        router.replace('/login?error=config');
        return;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) {
        router.replace('/login');
        return;
      }
      const [{ data: roleData, error: roleError }, { data: profileData }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle(),
        supabase.from('profiles').select('full_name').eq('id', session.user.id).maybeSingle(),
      ]);
      if (roleError || !roleData?.role) {
        await supabase.auth.signOut();
        router.replace('/login?error=access');
        return;
      }
      if (mounted) {
        setStaff({
          name: profileData?.full_name || session.user.email?.split('@')[0] || 'Usuario',
          email: session.user.email || '',
          role: roleData.role as StaffState['role'],
        });
        setChecking(false);
      }
    }
    verify();
    return () => { mounted = false; };
  }, [router]);

  async function logout() {
    if (supabase) await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  if (checking) {
    return <div className="fullscreen-state"><div className="spinner"/><p>Verificando acceso…</p></div>;
  }

  const roleLabel = staff?.role === 'superadmin' ? 'Superadministrador' : staff?.role === 'branch_admin' ? 'Administrador de sucursal' : 'Recepción';

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
        <div>
          <Link href="/dashboard" className="brand brand-link" onClick={() => setMenuOpen(false)}>HAUT <span>CLINICAL</span></Link>
          <p className="eyebrow sidebar-eyebrow">CLINICAL CENTER · ADMIN</p>
          <nav className="sidebar-nav">
            {navigation.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return <Link key={item.href} className={active ? 'active' : ''} href={item.href} onClick={() => setMenuOpen(false)}><span className="sidebar-nav-icon"><Icon name={item.icon} size={18}/></span><span>{item.label}</span>{active&&<span className="sidebar-nav-active-indicator"/>}</Link>;
            })}
          </nav>
        </div>
        <div className="staff-card">
          <div className="staff-avatar">{staff?.name.slice(0, 2).toUpperCase()}</div>
          <div className="staff-copy"><strong>{staff?.name}</strong><span>{roleLabel}</span></div>
          <button className="text-button" onClick={logout} aria-label="Cerrar sesión"><Icon name="logout" size={16}/></button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen?'Cerrar menú':'Abrir menú'}><Icon name={menuOpen?'back':'sliders'} size={20}/></button>
          <div>
            <p className="eyebrow">HAUT · ADMINISTRACIÓN</p>
            <h1>{sectionTitle}</h1>
          </div>
          <div className="topbar-user">
            <div className="topbar-user-copy"><strong>{staff?.name}</strong><span>{staff?.email}</span></div>
            <div className="avatar">{staff?.name.slice(0, 2).toUpperCase()}</div>
          </div>
        </header>
        {children}
      </main>
      {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Cerrar menú"/>}
    </div>
  );
}
