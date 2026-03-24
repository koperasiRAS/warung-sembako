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

  // Ensure an open shift exists for this cashier (DB-backed, idempotent)
  const supabase = await createClient();
  const { data: openShift } = await supabase.rpc('ensure_open_shift', {
    p_cashier_id: user.id,
  });
  const shiftId: string | null = openShift?.[0]?.id || null;

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
