import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import POSClient from './POSClient';

export const dynamic = 'force-dynamic';

async function getProducts() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*)
    `)
    .gt('stock', 0)
    .order('name', { ascending: true });

  return products || [];
}

async function getCategories() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  return categories || [];
}

export default async function POSPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  // Check if there's an open shift for this cashier — redirect if none
  const supabase = await createClient();
  const { data: openShiftRows } = await supabase
    .from('shifts')
    .select('id')
    .eq('cashier_id', user.id)
    .eq('status', 'open')
    .limit(1);

  if (!openShiftRows || openShiftRows.length === 0) {
    redirect('/pos/shift?reason=no_shift');
  }

  const shiftId = openShiftRows[0].id;

  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return (
    <POSClient
      initialProducts={products}
      initialCategories={categories}
      user={{ id: user.id, email: user.email || '' }}
      shiftId={shiftId}
    />
  );
}
