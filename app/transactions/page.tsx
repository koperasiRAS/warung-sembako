import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import TransactionsClient from './TransactionsClient';

export const dynamic = 'force-dynamic';

async function getTransactions(page: number = 1, limit: number = 20) {
  const supabase = await createClient();
  const offset = (page - 1) * limit;

  const { data: transactions, count } = await supabase
    .from('transactions')
    .select(`
      *,
      cashier:profiles!cashier_id(full_name)
    `, { count: 'exact' })
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  return {
    transactions: transactions || [],
    total: count || 0,
    totalPages: Math.ceil((count || 0) / limit),
  };
}

interface TransactionsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const params = await searchParams;
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  const page = parseInt(params.page || '1');
  const { transactions, total, totalPages } = await getTransactions(page);

  return (
    <TransactionsClient
      initialTransactions={transactions}
      currentPage={page}
      totalPages={totalPages}
      total={total}
    />
  );
}
