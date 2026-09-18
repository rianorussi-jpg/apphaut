"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const reason = new URLSearchParams(window.location.search).get('error');
    if (reason === 'access') setError('Este usuario no tiene un rol administrativo asignado.');
    if (reason === 'config') setError('Faltan las variables de Supabase en Vercel.');
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace('/dashboard');
    });
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    if (!supabase || !isSupabaseConfigured) {
      setError('Supabase no está configurado. Revisa las variables de entorno en Vercel.');
      return;
    }
    setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError || !data.user) {
      setLoading(false);
      setError('Correo o contraseña incorrectos.');
      return;
    }
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', data.user.id)
      .maybeSingle();
    if (roleError || !roleData?.role) {
      await supabase.auth.signOut();
      setLoading(false);
      setError('Este usuario existe, pero no tiene acceso al panel administrativo.');
      return;
    }
    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="login-brand">HAUT <span>CLINICAL</span></div>
        <div className="login-visual-copy">
          <p className="eyebrow">Panel administrativo</p>
          <h1>La operación de Haut, en un solo lugar.</h1>
          <p>Agenda por cabina, clientes, tratamientos, sesiones y sucursales conectados a Supabase.</p>
        </div>
      </section>
      <section className="login-panel">
        <form className="login-card" onSubmit={submit}>
          <p className="eyebrow">Acceso seguro</p>
          <h2>Iniciar sesión</h2>
          <p className="muted">Usa el usuario administrativo creado en Supabase Auth.</p>
          <label>Correo electrónico<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="admin@hautclinical.com"/></label>
          <label>Contraseña<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••"/></label>
          {error && <div className="alert error-alert">{error}</div>}
          <button className="primary-button" disabled={loading}>{loading ? 'Ingresando…' : 'Iniciar sesión'}</button>
          <small>El acceso y los datos están protegidos además por las políticas RLS de Supabase.</small>
        </form>
      </section>
    </main>
  );
}
