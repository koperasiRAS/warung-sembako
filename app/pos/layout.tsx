import { redirect } from 'next/navigation';
import { getUser } from '@/lib/supabase/server';
import { Providers } from '@/components/providers/Providers';

export default async function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <Providers>
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    </Providers>
  );
}
