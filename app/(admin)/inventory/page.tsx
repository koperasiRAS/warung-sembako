import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import InventoryClient from './InventoryClient';
import { inventoryService } from '@/services/inventory.service';
import type { Product } from '@/lib/supabase/types';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { page?: string; search?: string };
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Ensure only owners have access to this page (or cashier if role defined in layout, but let's check role)
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'owner' && profile?.role !== 'cashier') {
    redirect('/pos');
  }

  const page = searchParams.page ? parseInt(searchParams.page) : 1;
  const search = searchParams.search || '';

  try {
    // Manually fetch products using Server Component Supabase to avoid RLS anonymous block
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, stock, cost_price')
      .order('name', { ascending: true });

    const offset = (page - 1) * 20;
    let query = supabase
      .from('inventory_transactions')
      .select('*, product:products!inner(*)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%`, { foreignTable: 'products' });
    }

    const { data: trxData, count } = await query.range(offset, offset + 19);

    return (
      <InventoryClient 
        initialTransactions={(trxData as any) || []} 
        products={(productsData as unknown as Product[]) || []} 
        pagination={{
           page: page,
           total: count || 0,
           totalPages: Math.ceil((count || 0) / 20),
           pageSize: 20
        }} 
      />
    );
  } catch (error) {
    console.error('Error loading inventory data:', error);
    return (
      <div className="p-8 text-center text-red-500">
        Gagal memuat data histori inventaris. Silakan muat ulang halaman.
      </div>
    );
  }
}
