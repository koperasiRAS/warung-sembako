import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import CategoriesClient from './CategoriesClient';

export const dynamic = 'force-dynamic';

async function getCategories() {
  const supabase = await createClient();

  const [categoriesRes, countsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .order('name', { ascending: true }),

    supabase
      .from('products')
      .select('category_id', { count: 'exact' })
  ]);

  const categories = categoriesRes.data || [];
  // Build a map of category_id -> product count efficiently (no fetch-all products)
  const countMap: Record<string, number> = {};
  for (const row of countsRes.data || []) {
    if (row.category_id) {
      countMap[row.category_id] = (countMap[row.category_id] || 0) + 1;
    }
  }

  const categoriesWithCount = categories.map((cat) => ({
    ...cat,
    productCount: countMap[cat.id] || 0,
  }));

  return categoriesWithCount;
}

export default async function CategoriesPage() {
  const user = await getUser();

  if (!user) {
    redirect('/pin');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  const categories = await getCategories();

  return <CategoriesClient initialCategories={categories} />;
}
