const modules = [
  ['Agenda', 'Calendario diario/semanal por cabina'],
  ['Citas', 'Reservas, estados y movimientos'],
  ['Clientes', 'Directorio, historial y tratamientos activos'],
  ['Tratamientos', 'Catálogo, sesiones, duración y sucursales'],
  ['Sucursales y cabinas', 'Recursos dinámicos por sucursal'],
  ['Horarios y bloqueos', 'Apertura, excepciones y bloqueos'],
  ['Usuarios y permisos', 'Superadmin, administrador y recepción'],
  ['Configuración', 'Reglas generales del sistema'],
];

export default function AdminHomePage() {
  return (
    <main className="admin-shell">
      <aside className="sidebar">
        <div>
          <div className="brand">HAUT <span>CLINICAL</span></div>
          <p className="eyebrow">Administración</p>
        </div>
        <nav>
          <a className="active" href="#dashboard">Dashboard</a>
          {modules.slice(0, 7).map(([name]) => <a key={name} href={`#${name.toLowerCase().replaceAll(' ', '-')}`}>{name}</a>)}
        </nav>
        <div className="sidebar-note">Fase 2 · Base web lista para Vercel</div>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">HAUT CLINICAL</p>
            <h1>Panel administrativo</h1>
          </div>
          <div className="avatar">HC</div>
        </header>

        <section className="hero" id="dashboard">
          <div>
            <span className="pill">Arquitectura conectable a Supabase</span>
            <h2>Operación central de Haut Clinical</h2>
            <p>Agenda, clientes, tratamientos, sesiones, sucursales y cabinas vivirán en este panel. La autenticación real se implementa en la siguiente fase.</p>
          </div>
          <div className="hero-stat"><strong>3</strong><span>Sucursales iniciales</span></div>
        </section>

        <div className="stats">
          <article><span>Citas de hoy</span><strong>—</strong><small>Se conectará a Supabase</small></article>
          <article><span>Citas de mañana</span><strong>—</strong><small>Se conectará a Supabase</small></article>
          <article><span>Ocupación</span><strong>—</strong><small>Por cabina y sucursal</small></article>
          <article><span>Tratamientos activos</span><strong>—</strong><small>Planes de clientes</small></article>
        </div>

        <section className="module-grid">
          {modules.map(([name, description]) => (
            <article className="module-card" key={name} id={name.toLowerCase().replaceAll(' ', '-')}>
              <div className="module-icon">+</div>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </section>
      </section>
    </main>
  );
}
