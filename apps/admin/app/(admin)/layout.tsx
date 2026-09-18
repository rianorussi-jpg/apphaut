import AdminShell from '../../components/AdminShell';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
