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

  // Auto-close all open shifts at end of day
  const { error } = await supabaseAdmin
    .from('shifts')
    .update({
      status: 'closed',
      end_time: new Date().toISOString(),
      expected_cash: 0,
      actual_cash: 0,
      variance: 0,
    })
    .eq('status', 'open');

  if (error) {
    console.error('Auto-close shifts error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: 'All open shifts auto-closed.' });
}
