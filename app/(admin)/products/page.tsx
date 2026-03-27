import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import ProductsClient from './ProductsClient';
import type { Product, Category } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

interface Props {
  searchParams: Promise<{ page?: string; search?: string; category?: string }>;
}

async function getProducts(params: {
  page: number;
  search?: string;
  categoryId?: string;
}) {
  const supabase = await createClient();
  const { page, search, categoryId } = params;
  const offset = (page - 1) * PAGE_SIZE;

  let query = supabase
    .from('products')
    .select(
      `
      id,
      name,
      price,
      cost_price,
      stock,
      low_stock_threshold,
      category_id,
      barcode,
      sku,
      image_url,
      created_at,
      updated_at,
      category:categories(id, name)
    `,
      { count: 'exact' }
    )
    .order('name', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);

  if (search) {
    query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%,sku.ilike.%${search}%`);
  }

  if (categoryId) {
    query = query.eq('category_id', categoryId);
  }

  const { data, count, error } = await query;

  if (error) {
    console.error('Error fetching products:', error);
    return { products: [], total: 0 };
  }

  return {
    products: (data as unknown as Product[]) || [],
    total: count || 0,
  };
}

async function getCategories() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description')
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return (data as Category[]) || [];
}

export default async function ProductsPage(props: Props) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || '1', 10);
  const search = searchParams.search || undefined;
  const categoryId = searchParams.category || undefined;

  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
    redirect('/pos');
  }

  const [{ products, total }, categories] = await Promise.all([
    getProducts({ page, search, categoryId }),
    getCategories(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <ProductsClient
      initialProducts={products}
      initialCategories={categories}
      pagination={{
        page,
        total,
        totalPages,
        pageSize: PAGE_SIZE,
      }}
    />
  );
}