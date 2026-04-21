import { NextResponse } from 'next/server';
import { getUser, getProfile } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

export async function DELETE() {
  try {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: SUPABASE_SERVICE_ROLE_KEY environment variable is not set. Please add it in Vercel Dashboard → Settings → Environment Variables.' },
        { status: 500 }
      );
    }
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey
    );
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await getProfile(user.id);
    if (profile?.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden. Owner strictly required.' }, { status: 403 });
    }

    // 1. Delete all operational tables data from Supabase DB using the service_role
    // Note: Thanks to cascading deletes and dependency logic, we delete from leaf nodes up to root nodes.
    // NOTE: products & categories are NOT deleted — they are preserved on reset
    const tablesToClean = [
      'debt_payments',
      'debts',
      'transaction_items',
      'transactions',
      'inventory_transactions',
      'expenses',
      'daily_balances',
      'shifts'
    ];

    for (const table of tablesToClean) {
      // More readable pattern: delete all rows explicitly
      const { error } = await supabaseAdmin.from(table).delete().not('id', 'is', 'id');
      if (error) {
        console.error(`Error deleting table ${table}:`, error);
        return NextResponse.json({ error: `Failed to clean table: ${table}. ${error.message}` }, { status: 500 });
      }
    }

    // 2. Delete all cashier profiles
    // First we fetch all non-owner profiles
    const { data: cashiers, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('role', 'cashier');

    if (fetchError) {
       console.error('Error fetching cashiers:', fetchError);
       return NextResponse.json({ error: 'Failed to locate cashier profiles.' }, { status: 500 });
    }

    // Delete all cashier auth accounts
    for (const cashier of cashiers || []) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(cashier.id);
      if (deleteAuthError) {
        console.error(`Failed to delete cashier auth ${cashier.id}:`, deleteAuthError);
        // If auth deletion fails, profile orphan is acceptable — continue
      }
    }

    // Hard delete cashier profiles (even if auth deletion failed,
    // to prevent orphaned records blocking new registrations)
    const { error: deleteProfilesError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('role', 'cashier');

    if (deleteProfilesError) {
      console.error('Failed to delete cashier profiles:', deleteProfilesError);
      return NextResponse.json(
        { error: `Gagal menghapus profil kasir. ${deleteProfilesError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'System database successfully formatted.' }, { status: 200 });

  } catch (err: any) {
    console.error('System formatting exception:', err);
    return NextResponse.json({ error: 'Internal server error during formatting.' }, { status: 500 });
  }
}
