import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Cron: runs every day at 00:00 midnight Jakarta time (Asia/Jakarta)
// Initializes today's daily_balance from yesterday's closing balance
// Registered in vercel.json: "0 0 * * *"
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

  // Get Jakarta date
  const now = new Date();
  const jakartaOffset = 7 * 60; // UTC+7
  const jakartaDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + (jakartaOffset * 60000));
  const todayStr = jakartaDate.toISOString().split('T')[0];
  const yesterday = new Date(jakartaDate);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Get yesterday's balance to carry forward
  const { data: yesterdayBalance } = await supabaseAdmin
    .from('daily_balances')
    .select('cash_balance, bank_balance')
    .eq('date', yesterdayStr)
    .single();

  // Check if today's balance already exists
  const { data: todayBalance } = await supabaseAdmin
    .from('daily_balances')
    .select('id')
    .eq('date', todayStr)
    .single();

  if (!todayBalance) {
    // Initialize today's balance from yesterday's closing balance
    const { error: insertError } = await supabaseAdmin
      .from('daily_balances')
      .insert({
        date: todayStr,
        cash_balance: yesterdayBalance?.cash_balance ?? 0,
        bank_balance: yesterdayBalance?.bank_balance ?? 0,
        opening_cash: 0,
      });

    if (insertError) {
      console.error('Init daily_balance error:', insertError);
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    message: 'Daily rollover complete.',
    today: todayStr,
    yesterdayBalance: yesterdayBalance ? {
      cash_balance: yesterdayBalance.cash_balance,
      bank_balance: yesterdayBalance.bank_balance,
    } : null,
  });
}
