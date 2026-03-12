import { createClient } from '@/lib/supabase/client';
import { Product } from '@/lib/supabase/types';

export interface InventoryTransaction {
  id: string;
  product_id: string;
  type: 'restock' | 'adjustment' | 'sale' | 'damaged';
  quantity: number;
  cost_price: number;
  supplier_name: string | null;
  note: string | null;
  created_at: string;
  processed_by: string;
  product?: Product;
}

export const inventoryService = {
  async getInventoryHistory(params: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    const supabase = createClient();
    const { page = 1, limit = 20, search } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('inventory_transactions')
      .select('*, product:products!inner(*)', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`name.ilike.%${search}%`, { foreignTable: 'products' });
    }

    const { data, count, error } = await query
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data as InventoryTransaction[] || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async recordRestock({
    product_id,
    quantity,
    cost_price,
    supplier_name,
    note
  }: {
    product_id: string;
    quantity: number;
    cost_price: number;
    supplier_name?: string;
    note?: string;
  }): Promise<void> {
    const supabase = createClient();
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // 1. Get current product to update stock
    const { data: product, error: fetchError } = await supabase
      .from('products')
      .select('stock, cost_price')
      .eq('id', product_id)
      .single();
      
    if (fetchError || !product) throw fetchError || new Error('Product not found');

    const newStock = product.stock + quantity;
    
    // We update the product's cost_price as well if it changed during restock
    const productUpdates = {
      stock: newStock,
      cost_price: cost_price > 0 ? cost_price : product.cost_price
    };

    // 2. Perform sequential updates
    const { error: updateError } = await supabase
      .from('products')
      .update(productUpdates)
      .eq('id', product_id);

    if (updateError) throw updateError;
    
    // 3. Insert history record
    const { error: insertError } = await supabase
      .from('inventory_transactions')
      .insert({
        product_id,
        type: 'restock',
        quantity,
        cost_price,
        supplier_name: supplier_name || null,
        note: note || null,
        processed_by: user.id
      });

    if (insertError) {
      // Rollback is manual if no RPC
      console.error('Failed to insert history, but stock updated:', insertError);
      throw insertError;
    }
  }
};
