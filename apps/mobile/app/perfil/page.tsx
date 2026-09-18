import { MobileShell } from '@/components/MobileShell';
export default function Profile(){return <MobileShell title="Perfil">
  <article className="card"><h3>Mariana López</h3><p>cliente@ejemplo.com</p><p>+52 442 000 0000</p></article>
  <div className="card profile-list"><a>Mis datos <span>›</span></a><a>Notificaciones <span>›</span></a><a>Privacidad <span>›</span></a><a>Ayuda <span>›</span></a></div>
</MobileShell>}
