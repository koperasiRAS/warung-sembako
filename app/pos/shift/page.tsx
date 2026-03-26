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

  // Only query existing open shift — do NOT create one here (that happens only when user clicks "Buka Shift Baru")
  const { data: existingShift } = await supabase
    .from('shifts')
    .select('id, opening_cash, start_time')
    .eq('cashier_id', user.id)
    .eq('status', 'open')
    .limit(1);

  const openShiftId: string | null = existingShift?.[0]?.id || null;
  const shiftStartTime: string | null = existingShift?.[0]?.start_time || null;

  // Get today's date start (Jakarta timezone)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build transaction query: filter by current shift's start_time if shift is open
  // This ensures only transactions within the CURRENT shift are counted
  let transactionQuery = supabase
    .from('transactions')
    .select('total, payment_method, created_at')
    .eq('cashier_id', user.id)
    .eq('status', 'completed');

  if (shiftStartTime) {
    // Only count transactions AFTER this shift opened
    transactionQuery = transactionQuery.gte('created_at', shiftStartTime);
  } else {
    // No open shift yet — show nothing for this shift
    transactionQuery = transactionQuery.gte('created_at', today.toISOString())
      .lt('created_at', '1970-01-01'); // impossible range = no results
  }

  const { data: transactions } = await transactionQuery;

  // Calculate stats for current shift only
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
    openingCash: existingShift?.[0]?.opening_cash
      ? Number(existingShift[0].opening_cash)
      : 0,
  };

  return <ShiftClient initialData={shiftData} openShiftId={openShiftId} reason={reason} />;
}
