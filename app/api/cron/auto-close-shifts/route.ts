import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron: runs every day at 23:59 Jakarta time (Asia/Jakarta)
// Must be registered in vercel.json cron config
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  );

  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // Step 1: Get all open shifts and their expected cash
  const { data: openShifts } = await supabaseAdmin
    .from('shifts')
    .select('id, cashier_id, opening_cash, start_time')
    .eq('status', 'open');

  if (!openShifts || openShifts.length === 0) {
    return NextResponse.json({ message: 'No open shifts to close.' });
  }

  // Step 2: For each open shift, calculate expected_cash = opening_cash + cash sales in this shift
  for (const shift of openShifts) {
    const shiftStart = shift.start_time;
    const closingCash = Number(shift.opening_cash) || 0;

    // Get cash sales in this shift
    const { data: cashTxns } = await supabaseAdmin
      .from('transactions')
      .select('total')
      .eq('cashier_id', shift.cashier_id)
      .eq('status', 'completed')
      .eq('payment_method', 'cash')
      .gte('created_at', shiftStart)
      .lt('created_at', now);

    const cashSales = (cashTxns || []).reduce((sum, t) => sum + Number(t.total), 0);
    const expectedCash = closingCash + cashSales;

    // Auto-close with expected_cash = opening_cash + cash sales (no actual count at midnight)
    const { error } = await supabaseAdmin
      .from('shifts')
      .update({
        status: 'closed',
        end_time: now,
        expected_cash: expectedCash,
        actual_cash: expectedCash, // Auto-close = assume no variance
        variance: 0,
      })
      .eq('id', shift.id)
      .eq('status', 'open'); // only if still open

    if (error) {
      console.error(`Auto-close shift ${shift.id} error:`, error);
      continue;
    }

    // Reconcile daily_balances: set cash_balance to actual cash counted
    // (which equals expected since we auto-close at midnight)
    const { data: todayBalance } = await supabaseAdmin
      .from('daily_balances')
      .select('id, cash_balance')
      .eq('date', today)
      .single();

    if (todayBalance) {
      // Update to reflect the actual physical cash at auto-close
      // This becomes the opening cash for the next day
      const { error: balanceError } = await supabaseAdmin
        .from('daily_balances')
        .update({
          cash_balance: expectedCash,
          updated_at: now,
        })
        .eq('date', today);
      if (balanceError) {
        console.error('Auto-close daily_balances error:', balanceError);
      }
    }
  }

  return NextResponse.json({
    message: `Auto-closed ${openShifts.length} shift(s).`,
    shifts: openShifts.map(s => s.id),
  });
}
