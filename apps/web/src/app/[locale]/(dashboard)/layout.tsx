import { AuthGuard } from '../../../../../../packages/auth/dist';
import DashboardLayout from '../../(dashboard)/layout';

export default function LocaleDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  console.log('LocaleDashboardLayout');
  return (
    <AuthGuard>
      <DashboardLayout>{children}</DashboardLayout>
    </AuthGuard>
  );
}
