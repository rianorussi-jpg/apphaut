import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Haut Clinical Admin',
  description: 'Panel administrativo de Haut Clinical',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
