'use client';

import { useMemo, useState } from 'react';
import { MobileShell } from '@/components/MobileShell';
import { useClient } from '@/components/ClientProvider';
import { TreatmentTile } from '@/components/TreatmentTile';

// "Todos" y "Favoritos" son filtros; las únicas categorías comerciales son estas tres.
const CATALOG_CATEGORIES = ['depilacion-laser', 'corporales', 'faciales'] as const;

export default function TreatmentsPage() {
  const { data } = useClient();
  const [category, setCategory] = useState('all');

  const allowedCategories = useMemo(() =>
    CATALOG_CATEGORIES.map(slug => data?.categories.find(c => c.slug === slug)).filter(
      (c): c is NonNullable<typeof c> => Boolean(c)
    ), [data?.categories]
  );
  const items = useMemo(() => data?.treatments.filter(t =>
    category === 'all' || (category === 'featured' ? t.is_featured : t.category_id === category)
  ) ?? [], [data?.treatments, category]);

  return <MobileShell title="Tratamientos">
    <p className="subtle">Explora nuestros tratamientos. Solicita información por WhatsApp desde su detalle.</p>
    <div className="chips" role="group" aria-label="Filtrar tratamientos">
      <button type="button" onClick={() => setCategory('all')} className={`chip ${category === 'all' ? 'active' : ''}`}>Todos</button>
      <button type="button" onClick={() => setCategory('featured')} className={`chip ${category === 'featured' ? 'active' : ''}`}>Favoritos</button>
      {allowedCategories.map(c => <button type="button" key={c.id} className={`chip ${category === c.id ? 'active' : ''}`} onClick={() => setCategory(c.id)}>{c.name}</button>)}
    </div>
    {items.length
      ? <div className="catalog-grid">{items.map(t => <TreatmentTile key={t.id} treatment={t} />)}</div>
      : <div className="empty-card">No hay tratamientos disponibles en esta categoría por el momento.</div>}
  </MobileShell>;
}
