import { createClient } from '@/lib/supabase/client';
import { Product, Category, ApiResponse, PaginatedResponse } from '@/types';

export const productService = {
  async getProducts(params: {
    page?: number;
    limit?: number;
    search?: string;
    category_id?: string;
  }): Promise<PaginatedResponse<Product>> {
    const supabase = createClient();
    const { page = 1, limit = 20, search, category_id } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('products')
      .select('*, category:categories(*)', { count: 'exact' });

    if (search) {
      query = query.or(`name.ilike.%${search}%,barcode.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    const { data, count, error } = await query
      .range(offset, offset + limit - 1)
      .order('name');

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async getProductById(id: string): Promise<Product | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getProductByBarcode(barcode: string): Promise<Product | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .eq('barcode', barcode)
      .single();

    if (error) return null;
    return data;
  },

  async createProduct(product: Partial<Product>): Promise<Product> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .insert(product)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<Product> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('products')
      .update(product)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteProduct(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  async getLowStockProducts(threshold: number = 10): Promise<Product[]> {
    const supabase = createClient();
    // Use RPC which compares stock < COALESCE(low_stock_threshold, 10) per product
    const { data, error } = await supabase.rpc('get_low_stock_products', { limit_count: 10 });

    if (error) {
      // Fallback for databases that haven't run the migration yet
      const { data: fallback, error: fallbackError } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .lte('stock', threshold)
        .order('stock', { ascending: true })
        .limit(10);
      if (fallbackError) throw fallbackError;
      return fallback || [];
    }
    return data || [];
  }
};

export const categoryService = {
  async getCategories(): Promise<Category[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;
    return data || [];
  },

  async createCategory(category: Partial<Category>): Promise<Category> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('categories')
      .insert(category)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCategory(id: string, category: Partial<Category>): Promise<Category> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('categories')
      .update(category)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCategory(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};