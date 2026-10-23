import Link from 'next/link';

export function PublicPageShell({children,title,eyebrow='HAUT · INFORMACIÓN'}:{children:React.ReactNode;title:string;eyebrow?:string}){
  return <main className="public-page-wrap">
    <section className="public-page-shell">
      <header className="public-page-header">
        <Link href="/" className="public-page-logo" aria-label="Ir al inicio de HAUT"><img src="/logo.png" alt="HAUT Clinical Center"/></Link>
        <div><p className="brand-kicker">{eyebrow}</p><h1>{title}</h1></div>
      </header>
      <div className="public-page-content">{children}</div>
      <footer className="public-page-footer">
        <Link href="/terminos">Términos y condiciones</Link>
        <Link href="/privacidad">Política de privacidad</Link>
        <Link href="/soporte">Soporte</Link>
      </footer>
    </section>
  </main>;
}
