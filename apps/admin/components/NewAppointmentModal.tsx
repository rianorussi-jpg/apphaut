"use client";

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import {fetchBookingClients, type BookingClient} from '../lib/client-directory';

type Branch = { id: string; name: string };
type Client = BookingClient;
type Treatment = {
  id: string;
  name: string;
  default_duration_minutes: number;
  default_session_count: number;
  base_price: number | string;
  durationOverride: number | null;
  priceOverride: number | null;
};

type BookingResult = {
  appointment_id: string;
  plan_id: string;
  plan_session_id: string;
  cabin_id: string;
  cabin_name: string;
  session_number: number;
  total_sessions: number;
  starts_at: string;
  ends_at: string;
};

export type NewAppointmentSeed = {
  branchId: string;
  date: string;
  time: string;
  preferredCabinId?: string | null;
  preferredCabinName?: string | null;
};

export default function NewAppointmentModal({
  open,
  branches,
  seed,
  onClose,
  onCreated,
}: {
  open: boolean;
  branches: Branch[];
  seed: NewAppointmentSeed;
  onClose: () => void;
  onCreated: (booking: BookingResult) => void;
}) {
  const [clientId, setClientId] = useState('');
  const [treatmentId, setTreatmentId] = useState('');
  const [branchId, setBranchId] = useState(seed.branchId);
  const [date, setDate] = useState(seed.date);
  const [time, setTime] = useState(seed.time);
  const [notes, setNotes] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setBranchId(seed.branchId);
    setDate(seed.date);
    setTime(seed.time);
    setTreatmentId('');
    setNotes('');
    setError('');
  }, [open, seed.branchId, seed.date, seed.time, seed.preferredCabinId]);

  useEffect(() => {
    async function loadClients() {
      if (!open || !supabase) return;
      setLoadingOptions(true);
      try {
        const rows = await fetchBookingClients();
        setClients(rows);
        setClientId((current) => current && rows.some((item) => item.id === current) ? current : (rows[0]?.id ?? ''));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'No se pudo cargar el directorio de clientes.');
      }
      setLoadingOptions(false);
    }
    loadClients();
  }, [open]);

  useEffect(() => {
    async function loadTreatments() {
      if (!open || !supabase || !branchId) {
        setTreatments([]);
        setTreatmentId('');
        return;
      }

      setLoadingOptions(true);
      const { data: branchRows, error: branchError } = await supabase
        .from('treatment_branches')
        .select('treatment_id, price_override, duration_override_minutes')
        .eq('branch_id', branchId)
        .eq('is_active', true);

      if (branchError) {
        setError(branchError.message);
        setLoadingOptions(false);
        return;
      }

      const ids = (branchRows ?? []).map((row) => row.treatment_id);
      if (!ids.length) {
        setTreatments([]);
        setTreatmentId('');
        setLoadingOptions(false);
        return;
      }

      const { data: treatmentRows, error: treatmentError } = await supabase
        .from('treatments')
        .select('id, name, default_duration_minutes, default_session_count, base_price')
        .in('id', ids)
        .eq('is_active', true)
        .eq('catalog_details_pending', false)
        .order('name');

      if (treatmentError) {
        setError(treatmentError.message);
        setLoadingOptions(false);
        return;
      }

      const branchMap = new Map((branchRows ?? []).map((row) => [row.treatment_id, row]));
      const merged: Treatment[] = (treatmentRows ?? []).map((row) => {
        const branch = branchMap.get(row.id);
        return {
          ...row,
          durationOverride: branch?.duration_override_minutes ?? null,
          priceOverride: branch?.price_override == null ? null : Number(branch.price_override),
        };
      });

      setTreatments(merged);
      setTreatmentId((current) => current && merged.some((item) => item.id === current) ? current : (merged[0]?.id ?? ''));
      setLoadingOptions(false);
    }
    loadTreatments();
  }, [open, branchId]);

  const selectedTreatment = useMemo(
    () => treatments.find((item) => item.id === treatmentId),
    [treatments, treatmentId],
  );

  const preferredCabinApplies = branchId === seed.branchId && Boolean(seed.preferredCabinId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (!supabase) {
      setError('Supabase no está configurado.');
      return;
    }
    if (!clientId || !treatmentId || !branchId || !date || !time) {
      setError('Completa cliente, tratamiento, sucursal, fecha y hora.');
      return;
    }

    setSaving(true);
    const { data, error: bookingError } = await supabase.rpc('admin_create_appointment', {
      p_client_id: clientId,
      p_treatment_id: treatmentId,
      p_branch_id: branchId,
      p_date: date,
      p_time: `${time}:00`,
      p_preferred_cabin_id: preferredCabinApplies ? seed.preferredCabinId ?? null : null,
      p_internal_notes: notes || null,
    });
    setSaving(false);

    if (bookingError) {
      setError(bookingError.message.replace(/^.*?: /, ''));
      return;
    }

    const booking = Array.isArray(data) ? data[0] : data;
    if (!booking) {
      setError('La cita no pudo crearse.');
      return;
    }

    onCreated(booking as BookingResult);
  }

  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="new-appointment-title">
        <div className="modal-head">
          <div>
            <p className="eyebrow">Agenda administrativa</p>
            <h2 id="new-appointment-title">Nueva cita</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <form className="booking-form" onSubmit={submit}>
          <div className="booking-form-grid">
            <label className="form-field form-field-wide">
              <span>Cliente</span>
              <select value={clientId} onChange={(event) => setClientId(event.target.value)} disabled={loadingOptions || !clients.length}>
                {!clients.length && <option value="">No hay clientes disponibles</option>}
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.full_name}{client.phone ? ` · ${client.phone}` : client.email ? ` · ${client.email}` : ''}
                  </option>
                ))}
              </select>
              {!clients.length && !loadingOptions && <small>Los clientes aparecen aquí cuando tienen un perfil de cliente en Supabase.</small>}
            </label>

            <label className="form-field form-field-wide">
              <span>Tratamiento</span>
              <select value={treatmentId} onChange={(event) => setTreatmentId(event.target.value)} disabled={loadingOptions || !treatments.length}>
                {!treatments.length && <option value="">No hay tratamientos en esta sucursal</option>}
                {treatments.map((treatment) => (
                  <option key={treatment.id} value={treatment.id}>{treatment.name}</option>
                ))}
              </select>
              {selectedTreatment && (
                <small>
                  {selectedTreatment.default_session_count > 1 ? `${selectedTreatment.default_session_count} sesiones · ` : ''}
                  {selectedTreatment.durationOverride ?? selectedTreatment.default_duration_minutes} min
                </small>
              )}
            </label>

            <label className="form-field form-field-wide">
              <span>Sucursal</span>
              <select value={branchId} onChange={(event) => setBranchId(event.target.value)}>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>

            <label className="form-field">
              <span>Fecha</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>

            <label className="form-field">
              <span>Hora</span>
              <input type="time" step="1800" value={time} onChange={(event) => setTime(event.target.value)} required />
            </label>

            {preferredCabinApplies && (
              <div className="preferred-cabin form-field-wide">
                <span>Cabina preferida</span>
                <strong>{seed.preferredCabinName || 'Cabina seleccionada'}</strong>
                <small>Se intentará usar primero esta cabina. Si no es compatible o ya se ocupó, el sistema buscará otra cabina compatible automáticamente.</small>
              </div>
            )}

            <label className="form-field form-field-wide">
              <span>Notas internas</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Opcional" />
            </label>
          </div>

          {error && <div className="alert error-alert">{error}</div>}

          <div className="booking-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary-button inline-button" disabled={saving || loadingOptions || !clients.length || !treatments.length}>
              {saving ? 'Creando cita…' : 'Confirmar cita'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
