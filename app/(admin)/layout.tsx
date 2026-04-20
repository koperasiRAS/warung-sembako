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
      <div className="min-h-dvh flex bg-background">
        <Sidebar role={profile?.role} />
        <main className="flex-1 lg:pl-64 min-h-dvh w-full">
          {children}
        </main>
      </div>
    </Providers>
  );
}
