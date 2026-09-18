"use client";

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { formatMoney, getAppointmentViews, statusLabel, type AppointmentView } from '../../../../lib/admin-data';

export default function AppointmentDetailPage(){
  const params=useParams<{appointmentId:string}>(); const [appointment,setAppointment]=useState<AppointmentView|null>(null); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{(async()=>{try{const rows=await getAppointmentViews({appointmentId:params.appointmentId,limit:1}); setAppointment(rows[0]??null)}catch(e){setError(e instanceof Error?e.message:'No se pudo cargar la cita.')}finally{setLoading(false)}})()},[params.appointmentId]);
  if(loading)return <div className="fullscreen-inline"><div className="spinner"/><span>Cargando cita…</span></div>;
  if(error)return <div className="alert error-alert">{error}</div>;
  if(!appointment)return <div className="empty-state large-empty"><strong>Cita no encontrada.</strong><Link href="/citas">Volver a citas</Link></div>;
  const start=new Date(appointment.startsAt), end=new Date(appointment.endsAt);
  return <section className="page-stack"><div><Link className="back-link" href="/citas">← Volver a citas</Link></div><section className="detail-hero"><div><p className="eyebrow">Cita</p><h2>{appointment.clientName}</h2><p>{appointment.treatmentName}{appointment.totalSessions&&appointment.totalSessions>1?` · Sesión ${appointment.sessionNumber} de ${appointment.totalSessions}`:''}</p></div><span className={`status-chip status-${appointment.status}`}>{statusLabel(appointment.status)}</span></section><div className="detail-grid"><article className="panel-card"><h3>Fecha y ubicación</h3><dl className="detail-list"><div><dt>Fecha</dt><dd>{start.toLocaleDateString('es-MX',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</dd></div><div><dt>Horario</dt><dd>{start.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})} – {end.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}</dd></div><div><dt>Sucursal</dt><dd>{appointment.branchName}</dd></div><div><dt>Cabina</dt><dd>{appointment.cabinName}</dd></div></dl></article><article className="panel-card"><h3>Pago</h3><dl className="detail-list"><div><dt>Estado</dt><dd>{appointment.paymentStatus}</dd></div><div><dt>Total esperado</dt><dd>{formatMoney(appointment.amountExpected)}</dd></div><div><dt>Pagado</dt><dd>{formatMoney(appointment.amountPaid)}</dd></div></dl></article></div><div className="info-banner">Las acciones para confirmar, finalizar, cancelar y reagendar se incorporarán con sus funciones transaccionales y políticas de escritura; esta pantalla ya está leyendo la cita real.</div></section>
}
