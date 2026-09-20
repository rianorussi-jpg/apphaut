"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getAppointmentViews, statusLabel } from '../../../lib/admin-data';
import { supabase } from '../../../lib/supabase';
import {Icon} from '../../../components/Icon';

type Stats = { branches: number; today: number; tomorrow: number; week: number; activePlans: number };

function dayStart(date: Date) { const d = new Date(date); d.setHours(0, 0, 0, 0); return d; }
function addDays(date: Date, days: number) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ branches: 0, today: 0, tomorrow: 0, week: 0, activePlans: 0 });
  const [todayAppointments, setTodayAppointments] = useState<Awaited<ReturnType<typeof getAppointmentViews>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      if (!supabase) return;
      try {
        const now = new Date();
        const today = dayStart(now);
        const tomorrow = addDays(today, 1);
        const dayAfterTomorrow = addDays(today, 2);
        const weekEnd = addDays(today, 7);

        const [branches, todayCount, tomorrowCount, weekCount, plans, appointments] = await Promise.all([
          supabase.from('branches').select('id', { count: 'exact', head: true }).eq('is_active', true),
          supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('starts_at', today.toISOString()).lt('starts_at', tomorrow.toISOString()).neq('status', 'cancelled'),
          supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('starts_at', tomorrow.toISOString()).lt('starts_at', dayAfterTomorrow.toISOString()).neq('status', 'cancelled'),
          supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('starts_at', today.toISOString()).lt('starts_at', weekEnd.toISOString()).neq('status', 'cancelled'),
          supabase.from('client_treatment_plans').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          getAppointmentViews({ from: today.toISOString(), to: tomorrow.toISOString(), limit: 12 }),
        ]);
        const queryError = branches.error || todayCount.error || tomorrowCount.error || weekCount.error || plans.error;
        if (queryError) throw queryError;
        setStats({
          branches: branches.count ?? 0,
          today: todayCount.count ?? 0,
          tomorrow: tomorrowCount.count ?? 0,
          week: weekCount.count ?? 0,
          activePlans: plans.count ?? 0,
        });
        setTodayAppointments(appointments);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'No se pudo cargar el dashboard.');
      } finally { setLoading(false); }
    }
    load();
  }, []);

  return (
    <>
      <section className="hero compact-hero">
        <div>
          <span className="pill live-pill">● ACTIVIDAD EN TIEMPO REAL</span>
          <h2>Bienvenido a tu espacio HAUT</h2>
          <p>Todo lo que necesitas para acompañar a tus clientes y organizar la operación de cada sucursal.</p>
        </div>
        <div className="hero-stat"><strong>{loading ? '…' : stats.branches}</strong><span>Sucursales activas</span></div>
      </section>

      {error && <div className="alert error-alert page-alert">{error}</div>}

      <section className="stats">
        <article><span>Citas de hoy</span><strong>{loading ? '—' : stats.today}</strong><small>Reservas no canceladas</small></article>
        <article><span>Citas de mañana</span><strong>{loading ? '—' : stats.tomorrow}</strong><small>Agenda próxima</small></article>
        <article><span>Próximos 7 días</span><strong>{loading ? '—' : stats.week}</strong><small>Total programado</small></article>
        <article><span>Tratamientos activos</span><strong>{loading ? '—' : stats.activePlans}</strong><small>Planes de clientes</small></article>
      </section>

      <div className="dashboard-grid">
        <section className="panel-card span-2">
          <div className="section-heading"><div><p className="eyebrow">Hoy</p><h3>Agenda del día</h3></div><Link className="secondary-button" href="/agenda">Abrir agenda</Link></div>
          {loading ? <div className="skeleton-list"><div/><div/><div/></div> : todayAppointments.length ? (
            <div className="appointment-list">
              {todayAppointments.map((appointment) => (
                <Link href={`/citas/${appointment.id}`} className="appointment-row" key={appointment.id}>
                  <div className="appointment-time">{new Date(appointment.startsAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div className="appointment-main"><strong>{appointment.clientName}</strong><span>{appointment.treatmentName}{appointment.totalSessions && appointment.totalSessions > 1 ? ` · Sesión ${appointment.sessionNumber} de ${appointment.totalSessions}` : ''}</span></div>
                  <div className="appointment-meta"><span>{appointment.branchName} · {appointment.cabinName}</span><span className={`status-chip status-${appointment.status}`}>{statusLabel(appointment.status)}</span></div>
                </Link>
              ))}
            </div>
          ) : <div className="empty-state"><strong>No hay citas para hoy.</strong><span>Cuando existan reservas aparecerán aquí automáticamente.</span></div>}
        </section>

        <section className="panel-card">
          <div className="section-heading"><div><p className="eyebrow">Accesos</p><h3>Operación</h3></div></div>
          <div className="quick-links">
            <Link href="/agenda"><span className="dashboard-quick-icon"><Icon name="calendar" size={19}/></span><strong>Agenda</strong><span>Consulta horarios y organiza tus citas <Icon name="forward" size={14}/></span></Link>
            <Link href="/clientes"><span className="dashboard-quick-icon"><Icon name="user" size={19}/></span><strong>Clientes</strong><span>Gestiona perfiles y tratamientos <Icon name="forward" size={14}/></span></Link>
            <Link href="/tratamientos"><span className="dashboard-quick-icon"><Icon name="sparkles" size={19}/></span><strong>Tratamientos</strong><span>Administra el catálogo y sus imágenes <Icon name="forward" size={14}/></span></Link>
            <Link href="/sucursales"><span className="dashboard-quick-icon"><Icon name="pin" size={19}/></span><strong>Sucursales</strong><span>Revisa cabinas y recursos <Icon name="forward" size={14}/></span></Link>
          </div>
        </section>
      </div>
    </>
  );
}
