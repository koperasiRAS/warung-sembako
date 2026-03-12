import { redirect } from 'next/navigation';
import { createClient, getUser, getProfile } from '@/lib/supabase/server';
import DebtsClient from './DebtsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DebtsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);
  const supabase = await createClient();

  if (profile?.role !== 'owner' && profile?.role !== 'cashier') {
    redirect('/pos');
  }

  // Fetch debts with transactions if needed
  const { data: debts } = await supabase
    .from('debts')
    .select(`
      *
    `)
    .order('created_at', { ascending: false });

  return <DebtsClient initialDebts={debts || []} userRole={profile.role} />;
}
