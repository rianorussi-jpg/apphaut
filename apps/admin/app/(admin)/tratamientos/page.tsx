'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/admin-data';

type Treatment = {
  id: string; name: string; short_description: string | null;
  base_price: number | string; default_duration_minutes: number;
  default_session_count: number; is_active: boolean; is_featured: boolean;
  catalog_details_pending: boolean; category_id: string | null;
};
type Category = { id: string; name: string; slug: string };
type Branch = { id: string; name: string };
type Cabin = { id: string; branch_id: string; name: string };

export default function TreatmentsPage() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [cabins, setCabins] = useState<Cabin[]>([]);
  const [chosenBranches, setChosenBranches] = useState<string[]>([]);
  const [chosenCabins, setChosenCabins] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [duration, setDuration] = useState('60');
  const [sessions, setSessions] = useState('1');
  const [interval, setInterval] = useState('');
  const [featured, setFeatured] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editDuration, setEditDuration] = useState('');
  const [editSessions, setEditSessions] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editFeatured, setEditFeatured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function load() {
    if (!supabase) { setError('Supabase no configurado.'); setLoading(false); return; }
    const [t, c, b, cb] = await Promise.all([
      supabase.from('treatments').select('id,name,short_description,base_price,default_duration_minutes,default_session_count,is_active,is_featured,catalog_details_pending,category_id').order('name'),
      supabase.from('treatment_categories').select('id,name,slug').eq('is_active', true).order('sort_order'),
      supabase.from('branches').select('id,name').eq('is_active', true).order('name'),
      supabase.from('cabins').select('id,branch_id,name').eq('is_active', true),
    ]);
    for (const response of [t, c, b, cb]) {
      if (response.error) { setError(response.error.message); setLoading(false); return; }
    }
    setTreatments(t.data ?? []);
    setCategories((c.data ?? []).filter(category => ['depilacion-laser', 'corporales', 'faciales'].includes(category.slug)));
    setBranches(b.data ?? []);
    setCabins(cb.data ?? []);
    setLoading(false);
  }
  useEffect(() => { void load(); }, []);
  const slugify = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  async function create(e: FormEvent) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!supabase) return;
    if (!chosenBranches.length || !chosenCabins.length) {
      setError('Selecciona al menos una sucursal y una cabina compatible.'); return;
    }
    if (chosenBranches.some(branch => !chosenCabins.some(id => cabins.find(c => c.id === id)?.branch_id === branch))) {
      setError('Elige por lo menos una cabina para cada sucursal seleccionada.'); return;
    }
    setSaving(true);
    const suffix = Math.random().toString(36).slice(2, 7);
    const { data: newTreatment, error: te } = await supabase.from('treatments').insert({
      name: name.trim(), slug: `${slugify(name)}-${suffix}`, category_id: categoryId || null,
      short_description: description.trim(), description: description.trim(),
      image_url: imageUrl.trim() || null, base_price: Number(price),
      default_duration_minutes: Number(duration), default_session_count: Number(sessions),
      recommended_interval_days: interval ? Number(interval) : null,
      is_featured: featured, is_active: true, catalog_details_pending: false,
    }).select('id').single();
    if (te || !newTreatment) { setError(te?.message ?? 'No se pudo crear.'); setSaving(false); return; }
    const { error: be } = await supabase.from('treatment_branches').insert(chosenBranches.map(branch_id => ({ treatment_id: newTreatment.id, branch_id, is_active: true })));
    if (be) { setError(`Se creó el tratamiento pero faltó habilitar sus sucursales: ${be.message}`); setSaving(false); await load(); return; }
    const selected = cabins.filter(c => chosenBranches.includes(c.branch_id) && chosenCabins.includes(c.id));
    const { error: ce } = await supabase.from('treatment_cabins').insert(selected.map(c => ({ treatment_id: newTreatment.id, branch_id: c.branch_id, cabin_id: c.id })));
    setSaving(false);
    if (ce) { setError(`Se creó el tratamiento, pero hay que completar sus cabinas: ${ce.message}`); await load(); return; }
    setSuccess('Tratamiento publicado. Ya aparece en el catálogo de clientes.');
    setName(''); setDescription(''); setImageUrl(''); setChosenBranches([]); setChosenCabins([]);
    await load();
  }

  function startEditing(t: Treatment) {
    setEditingId(t.id); setError(''); setSuccess('');
    setEditPrice(t.catalog_details_pending ? '' : String(t.base_price));
    setEditDuration(t.catalog_details_pending ? '' : String(t.default_duration_minutes));
    setEditSessions(t.catalog_details_pending ? '' : String(t.default_session_count));
    setEditCategoryId(t.category_id ?? ''); setEditFeatured(t.is_featured);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault(); setError(''); setSuccess('');
    if (!supabase || !editingId) return;
    // Nunca marcar como confirmado un tratamiento con valores no revisados.
    if (!editCategoryId || editPrice.trim() === '' || !Number.isFinite(Number(editPrice)) || Number(editPrice) < 0 ||
        !Number.isInteger(Number(editDuration)) || Number(editDuration) < 1 ||
        !Number.isInteger(Number(editSessions)) || Number(editSessions) < 1) {
      setError('Confirma la categoría, el precio real, la duración en minutos y el número de sesiones.'); return;
    }
    setSaving(true);
    const { error: updateError } = await supabase.from('treatments').update({
      category_id: editCategoryId, base_price: Number(editPrice),
      default_duration_minutes: Number(editDuration), default_session_count: Number(editSessions),
      is_featured: editFeatured, catalog_details_pending: false,
    }).eq('id', editingId);
    setSaving(false);
    if (updateError) { setError(updateError.message); return; }
    setEditingId(null);
    setSuccess('Datos confirmados. Para agendar este tratamiento, también debes configurar sus sucursales y cabinas compatibles.');
    await load();
  }

  return <section className="page-stack">
    <div className="page-heading"><p className="eyebrow">Catálogo</p><h2>Tratamientos</h2><p className="muted">Categorías oficiales: Depilación láser, Corporales y Faciales. Favoritos es un filtro, no una categoría.</p></div>
    {error && <div className="alert error-alert" role="alert">{error}</div>}
    {success && <div className="alert" role="status">{success}</div>}
    <form onSubmit={create} className="panel-card" style={{ display: 'grid', gap: 12, maxWidth: 760 }}>
      <h3>+ Nuevo tratamiento</h3>
      <label>Nombre<br/><input required maxLength={140} value={name} onChange={e => setName(e.target.value)}/></label>
      <label>Descripción<br/><textarea rows={3} value={description} onChange={e => setDescription(e.target.value)}/></label>
      <label>URL de imagen (opcional)<br/><input type="url" value={imageUrl} placeholder="https://..." onChange={e => setImageUrl(e.target.value)}/></label>
      <label>Categoría<br/><select required value={categoryId} onChange={e => setCategoryId(e.target.value)}><option value="">Selecciona una categoría</option>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label>Precio base (MXN)<br/><input type="number" min="0" step="0.01" required value={price} onChange={e => setPrice(e.target.value)}/></label>
      <label>Duración de cada sesión (minutos)<br/><input type="number" min="1" max="600" required value={duration} onChange={e => setDuration(e.target.value)}/></label>
      <label>Número predeterminado de sesiones<br/><input type="number" min="1" max="200" required value={sessions} onChange={e => setSessions(e.target.value)}/></label>
      <label>Intervalo recomendado (días, opcional)<br/><input type="number" min="0" value={interval} onChange={e => setInterval(e.target.value)}/></label>
      <label><input type="checkbox" checked={featured} onChange={e => setFeatured(e.target.checked)}/> Mostrar en Favoritos</label>
      <h4>Sucursales disponibles</h4>
      {branches.map(b => <label key={b.id}><input type="checkbox" checked={chosenBranches.includes(b.id)} onChange={e => { setChosenBranches(old => e.target.checked ? [...old, b.id] : old.filter(id => id !== b.id)); if (!e.target.checked) setChosenCabins(old => old.filter(id => cabins.find(c => c.id === id)?.branch_id !== b.id)); }}/>{' '}{b.name}</label>)}
      <h4>Cabinas compatibles</h4>
      {cabins.filter(c => chosenBranches.includes(c.branch_id)).map(c => <label key={c.id}><input type="checkbox" checked={chosenCabins.includes(c.id)} onChange={e => setChosenCabins(old => e.target.checked ? [...old, c.id] : old.filter(id => id !== c.id))}/>{' '}{branches.find(b => b.id === c.branch_id)?.name} · {c.name}</label>)}
      <button disabled={saving || loading} type="submit">{saving ? 'Guardando…' : 'Crear tratamiento'}</button>
    </form>
    <div className="section-title"><h2>Tratamientos existentes</h2></div>
    {loading ? <div className="fullscreen-inline"><div className="spinner"/></div> : treatments.length
      ? <div className="card-grid three-cols">{treatments.map(t => <article className="panel-card" key={t.id}>
          <span className="mini-pill">{t.is_active ? 'Activo' : 'Inactivo'}</span>
          {t.is_featured && <span className="mini-pill">Favorito</span>}
          {t.catalog_details_pending && <span className="mini-pill">Datos por confirmar</span>}
          <h3>{t.name}</h3><p className="muted">{t.short_description || 'Consulta detalles con Haut Clinical.'}</p>
          <p>{t.catalog_details_pending ? 'Precio, duración y sesiones pendientes de configurar' : `${t.default_duration_minutes} min · ${t.default_session_count} sesiones · ${formatMoney(Number(t.base_price))}`}</p>
          {editingId === t.id
            ? <form className="edit-form" onSubmit={saveEdit} style={{ display: 'grid', gap: 10, marginTop: 12 }}>
                <label>Categoría<br/><select required value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)}><option value="">Selecciona</option>{categories.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select></label>
                <label>Precio real (MXN)<br/><input type="number" min="0" step="0.01" required value={editPrice} onChange={e => setEditPrice(e.target.value)}/></label>
                <label>Duración real (minutos)<br/><input type="number" min="1" max="600" required value={editDuration} onChange={e => setEditDuration(e.target.value)}/></label>
                <label>Sesiones predeterminadas<br/><input type="number" min="1" max="200" required value={editSessions} onChange={e => setEditSessions(e.target.value)}/></label>
                <label><input type="checkbox" checked={editFeatured} onChange={e => setEditFeatured(e.target.checked)}/> Mostrar en Favoritos</label>
                <button type="submit" disabled={saving}>{saving ? 'Guardando…' : 'Guardar datos confirmados'}</button>
                <button type="button" className="secondary-button" onClick={() => setEditingId(null)}>Cancelar</button>
              </form>
            : <button type="button" className="secondary-button" onClick={() => startEditing(t)}>Configurar / editar datos</button>}
        </article>)}</div>
      : <div className="empty-state"><strong>Todavía no hay tratamientos creados.</strong></div>}
  </section>;
}
