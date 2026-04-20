import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import TransactionsClient from './TransactionsClient';

export const dynamic = 'force-dynamic';

async function getTransactions(page: number = 1, limit: number = 20) {
  const supabase = await createClient();
  const offset = (page - 1) * limit;

  const [transactionsRes, debtPaymentsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select(`
        *,
        cashier:profiles!cashier_id(full_name)
      `, { count: 'exact' })
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1),
      
    supabase
      .from('debt_payments')
      .select(`
        *,
        debt:debts(customer_name)
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)
  ]);

  const transactions = transactionsRes.data || [];
  const debtPayments = debtPaymentsRes.data || [];

  // Map debt payments to transaction-like objects
  const mappedDebtPayments = debtPayments.map((dp: any) => ({
    id: dp.id,
    total: dp.amount,
    payment_method: dp.payment_method || 'cash',
    status: 'completed',
    created_at: dp.created_at,
    cashier: { full_name: `Bayar Kasbon: ${dp.debt?.customer_name || 'Pelanggan'}` },
    is_debt_payment: true
  }));

  // Combine and sort
  const combined = [...transactions, ...mappedDebtPayments].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Take only the requested page size out of the combined set
  const paginated = combined.slice(0, limit);

  // Total count approximation (can be inaccurate if both have many pages, but good enough for simple viewing)
  const totalCount = (transactionsRes.count || 0) + (debtPaymentsRes.data?.length || 0);

  return {
    transactions: paginated,
    total: totalCount,
    totalPages: Math.ceil(totalCount / limit),
  };
}

interface TransactionsPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function TransactionsPage({ searchParams }: TransactionsPageProps) {
  const params = await searchParams;
  const user = await getUser();

  if (!user) {
    redirect('/pin');
  }

  const profile = await getProfile(user.id);

  if (!['owner', 'cashier'].includes(profile?.role || '')) {
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
