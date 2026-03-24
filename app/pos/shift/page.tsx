import { redirect } from 'next/navigation';
import { createClient, getUser, getProfile } from '@/lib/supabase/server';
import ShiftClient from './ShiftClient';

export const dynamic = 'force-dynamic';

export default async function ShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  return <ShiftPageContent reason={params.reason} />;
}

async function ShiftPageContent({ reason }: { reason?: string }) {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);
  const supabase = await createClient();

  // Find the cashier's transactions for TODAY
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of today

  const { data: transactions } = await supabase
    .from('transactions')
    .select('total, payment_method, created_at')
    .eq('cashier_id', user.id)
    .eq('status', 'completed')
    .gte('created_at', today.toISOString());

  // Calculate stats
  let totalSales = 0;
  let cashSales = 0;
  let nonCashSales = 0;
  let transactionCount = 0;

  if (transactions) {
    transactionCount = transactions.length;
    transactions.forEach(t => {
      totalSales += t.total;
      if (t.payment_method === 'cash') {
        cashSales += t.total;
      } else {
        nonCashSales += t.total;
      }
    });
  }

  const shiftData = {
    cashierName: profile?.full_name || profile?.email || 'Kasir',
    cashierId: user.id,
    date: new Date().toISOString(),
    totalSales,
    cashSales,
    nonCashSales,
    transactionCount,
  };

  // Only query existing open shift — do NOT create one here (that happens only when user clicks "Buka Shift Baru")
  const { data: existingShift } = await supabase
    .from('shifts')
    .select('id')
    .eq('cashier_id', user.id)
    .eq('status', 'open')
    .limit(1);
  const openShiftId: string | null = existingShift?.[0]?.id || null;

  return <ShiftClient initialData={shiftData} openShiftId={openShiftId} reason={reason} />;
}
