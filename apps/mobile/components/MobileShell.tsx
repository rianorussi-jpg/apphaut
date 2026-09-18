import { BottomNav } from './BottomNav';

export function MobileShell({ children, title, eyebrow = 'HAUT CLINICAL' }: { children: React.ReactNode; title?: string; eyebrow?: string }) {
  return (
    <main className="phone-page">
      <div className="app-frame">
        <header className="mobile-header">
          <div><p className="brand-kicker">{eyebrow}</p>{title && <h1>{title}</h1>}</div>
          <button className="round-button" aria-label="Notificaciones">○</button>
        </header>
        <div className="screen-content">{children}</div>
        <BottomNav />
      </div>
    </main>
  );
}
