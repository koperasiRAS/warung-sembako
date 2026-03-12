import { createClient } from '@/lib/supabase/client';
import { Transaction, TransactionItem, CartItem, PaginatedResponse } from '@/types';

export const transactionService = {
  async getTransactions(params: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    search?: string;
    status?: 'completed' | 'voided';
  }): Promise<PaginatedResponse<Transaction>> {
    const supabase = createClient();
    const { page = 1, limit = 20, startDate, endDate, search, status } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('transactions')
      .select('*, cashier:profiles(full_name)', { count: 'exact' });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59');
    }

    if (search) {
      query = query.like('id', `%${search}%`);
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    };
  },

  async getTransactionById(id: string): Promise<Transaction | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('transactions')
      .select('*, cashier:profiles(full_name)')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  async getTransactionItems(transactionId: string): Promise<TransactionItem[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('transaction_items')
      .select('*')
      .eq('transaction_id', transactionId);

    if (error) throw error;
    return data || [];
  },

  async createTransaction(params: {
    items: CartItem[];
    payment_method: 'cash' | 'qris' | 'transfer';
    cashier_id: string;
  }): Promise<Transaction> {
    const supabase = createClient();
    const { items, payment_method, cashier_id } = params;

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        total,
        payment_method,
        cashier_id,
        status: 'completed'
      })
      .select()
      .single();

    if (transactionError) throw transactionError;

    const transactionItems = items.map(item => ({
      transaction_id: transaction.id,
      product_id: item.product_id,
      qty: item.quantity,
      price: item.price
    }));

    const { error: itemsError } = await supabase
      .from('transaction_items')
      .insert(transactionItems);

    if (itemsError) throw itemsError;

    // Update product stock
    for (const item of items) {
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        p_product_id: item.product_id,
        p_quantity: item.quantity
      });

      if (stockError) {
        console.error('Failed to update stock:', stockError);
      }
    }

    return transaction;
  },

  async voidTransaction(id: string): Promise<void> {
    const supabase = createClient();

    // Get transaction items
    const { data: items } = await supabase
      .from('transaction_items')
      .select('*')
      .eq('transaction_id', id);

    // Restore stock
    if (items) {
      for (const item of items) {
        await supabase.rpc('increment_stock', {
          p_product_id: item.product_id,
          p_quantity: item.qty
        });
      }
    }

    // Update transaction status
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'voided' })
      .eq('id', id);

    if (error) throw error;
  },

  async getTodaySales(): Promise<number> {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('transactions')
      .select('total')
      .eq('status', 'completed')
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59');

    if (error) throw error;

    return (data || []).reduce((sum, t) => sum + Number(t.total), 0);
  },

  async getTodayTransactionCount(): Promise<number> {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const { count, error } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed')
      .gte('created_at', today)
      .lt('created_at', today + 'T23:59:59');

    if (error) throw error;
    return count || 0;
  }
};