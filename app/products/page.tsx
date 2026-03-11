import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import ProductsClient from './ProductsClient';

export const dynamic = 'force-dynamic';

async function getProducts() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from('products')
    .select(`
      *,
      category:categories(*)
    `)
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

export default async function ProductsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  const [products, categories] = await Promise.all([
    getProducts(),
    getCategories(),
  ]);

  return <ProductsClient initialProducts={products} initialCategories={categories} />;
}
