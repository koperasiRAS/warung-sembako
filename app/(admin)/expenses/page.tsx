import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import ExpensesClient from './ExpensesClient';

export const dynamic = 'force-dynamic';

async function getExpenses() {
  const supabase = await createClient();

  const { data: expenses } = await supabase
    .from('expenses')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  return expenses || [];
}

export default async function ExpensesPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  const expenses = await getExpenses();

  return <ExpensesClient initialExpenses={expenses} />;
}
