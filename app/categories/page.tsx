import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import CategoriesClient from './CategoriesClient';

export const dynamic = 'force-dynamic';

async function getCategories() {
  const supabase = await createClient();

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .order('name', { ascending: true });

  // Get product counts
  const { data: products } = await supabase
    .from('products')
    .select('category_id');

  const categoriesWithCount = (categories || []).map((cat) => ({
    ...cat,
    productCount: products?.filter((p) => p.category_id === cat.id).length || 0,
  }));

  return categoriesWithCount;
}

export default async function CategoriesPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  const categories = await getCategories();

  return <CategoriesClient initialCategories={categories} />;
}
