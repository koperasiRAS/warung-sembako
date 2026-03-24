import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import ExpensesClient from './ExpensesClient';

export const dynamic = 'force-dynamic';

async function getExpenses(page: number = 1, pageSize: number = 20) {
  const supabase = await createClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data: expenses, count } = await supabase
    .from('expenses')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  return {
    expenses: expenses || [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
    page,
    pageSize,
  };
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  const page = searchParams.page ? Number.parseInt(searchParams.page) : 1;
  const { expenses, total, totalPages, pageSize } = await getExpenses(page);

  return (
    <ExpensesClient
      initialExpenses={expenses}
      pagination={
        totalPages > 1
          ? { page, total, totalPages, pageSize }
          : undefined
      }
    />
  );
}
