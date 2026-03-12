import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import Sidebar from '@/components/layout/Sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <Sidebar role={profile?.role} />
      <main className="flex-1 lg:ml-64 min-h-screen w-full">
        {children}
      </main>
    </div>
  );
}
