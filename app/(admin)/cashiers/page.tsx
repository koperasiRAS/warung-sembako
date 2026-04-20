import { redirect } from 'next/navigation';
import { createClient, getUser, getProfile } from '@/lib/supabase/server';
import CashiersClient from './CashiersClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function CashiersPage() {
  const user = await getUser();

  if (!user) {
    redirect('/pin');
  }

  const profile = await getProfile(user.id);
  const supabase = await createClient();

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  // Fetch all users who have the role 'cashier'
  const { data: cashiers } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'cashier')
    .order('created_at', { ascending: false });

  return <CashiersClient initialCashiers={cashiers || []} />;
}
