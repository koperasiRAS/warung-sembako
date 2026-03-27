import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron: runs every day at 10:00 AM Jakarta time
// Daily health check — ensures daily_balances record exists for today
// (shift auto-close has been removed; daily rollover is handled by /api/cron-midnight)
export async function GET(request: Request) {
  if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
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

  // Ensure today's balance record exists (creates from yesterday if needed)
  const now = new Date();
  const jakartaOffset = 7 * 60;
  const jakartaDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (jakartaOffset * 60000));
  const todayStr = jakartaDate.toISOString().split('T')[0];
  const yesterday = new Date(jakartaDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { data: todayBalance } = await supabaseAdmin
    .from('daily_balances')
    .select('id')
    .eq('date', todayStr)
    .single();

  if (!todayBalance) {
    const { data: yesterdayBalance } = await supabaseAdmin
      .from('daily_balances')
      .select('cash_balance, bank_balance')
      .eq('date', yesterdayStr)
      .single();

    await supabaseAdmin
      .from('daily_balances')
      .insert({
        date: todayStr,
        cash_balance: yesterdayBalance?.cash_balance ?? 0,
        bank_balance: yesterdayBalance?.bank_balance ?? 0,
        opening_cash: 0,
      });
  }

  return NextResponse.json({ message: 'Daily health check complete.' });
}
