import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';
import { Providers } from '@/components/providers/Providers';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect('/pin');
  }

  const profile = await getProfile(user.id);

  return (
    <Providers>
      <div style={{ minHeight: '100dvh', display: 'flex', backgroundColor: 'var(--color-background)' }}>
        <Sidebar role={profile?.role} />
        <main style={{ flex: 1, marginLeft: '0', minHeight: '100dvh', width: '100%' }} className="lg:ml-64">
          {children}
        </main>
      </div>
    </Providers>
  );
}
