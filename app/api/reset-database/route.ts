import { NextResponse } from 'next/server';
import { getUser, getProfile } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function DELETE() {
  try {
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
    const tablesToClean = [
      'debt_payments', 
      'debts', 
      'transaction_items', 
      'transactions',
      'inventory_transactions',
      'expenses',
      'daily_balances',
      'products', 
      'categories', 
      'shifts'
    ];

    for (const table of tablesToClean) {
      const { error } = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Dummy condition to delete all rows securely
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

    // Attempt to delete auth user for every cashier account. The profiles record cascades automatically.
    for (const cashier of cashiers || []) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(cashier.id);
      if (deleteAuthError) {
         console.error(`Failed to delete cashier auth ${cashier.id}:`, deleteAuthError);
         // Continue loop regardless if one fails
      }
    }
    
    // As a final backup, hard delete profiles too if cascade didn't catch them
    await supabaseAdmin.from('profiles').delete().eq('role', 'cashier');

    return NextResponse.json({ message: 'System database successfully formatted.' }, { status: 200 });

  } catch (err: any) {
    console.error('System formatting exception:', err);
    return NextResponse.json({ error: 'Internal server error during formatting.' }, { status: 500 });
  }
}
