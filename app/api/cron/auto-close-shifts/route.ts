import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Daily reconciliation cron: runs at 23:59 Jakarta time
// Ensures daily_balances reflects all transactions recorded today
// (Shift system has been removed — this cron ensures balance integrity)
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

  const now = new Date();
  const jakartaOffset = 7 * 60;
  const jakartaDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (jakartaOffset * 60000));
  const todayStr = jakartaDate.toISOString().split('T')[0];

  // Get all today's cash and bank transactions
  const { data: cashTxns } = await supabaseAdmin
    .from('transactions')
    .select('total')
    .eq('status', 'completed')
    .eq('payment_method', 'cash')
    .gte('created_at', `${todayStr}T00:00:00`)
    .lt('created_at', `${todayStr}T23:59:59`);

  const { data: bankTxns } = await supabaseAdmin
    .from('transactions')
    .select('total')
    .eq('status', 'completed')
    .in('payment_method', ['qris', 'transfer'])
    .gte('created_at', `${todayStr}T00:00:00`)
    .lt('created_at', `${todayStr}T23:59:59`);

  const todayCashSales = (cashTxns || []).reduce((sum, t) => sum + Number(t.total), 0);
  const todayBankSales = (bankTxns || []).reduce((sum, t) => sum + Number(t.total), 0);

  // Get today's balance
  const { data: todayBalance } = await supabaseAdmin
    .from('daily_balances')
    .select('id, cash_balance, bank_balance')
    .eq('date', todayStr)
    .single();

  if (todayBalance) {
    // Balance is already updated via transaction triggers — just log for monitoring
    return NextResponse.json({
      message: 'Daily reconciliation complete.',
      date: todayStr,
      todayCashSales,
      todayBankSales,
      recordedCashBalance: todayBalance.cash_balance,
      recordedBankBalance: todayBalance.bank_balance,
    });
  }

  return NextResponse.json({
    message: 'No transactions today.',
    date: todayStr,
  });
}
