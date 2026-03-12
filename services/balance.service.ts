import { createClient } from '@/lib/supabase/client';
import { DailyBalance, Expense } from '@/types';

export const balanceService = {
  async getTodayBalance(): Promise<DailyBalance | null> {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabase
      .from('daily_balances')
      .select('*')
      .eq('date', today)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No balance for today, create one
        return this.createTodayBalance();
      }
      throw error;
    }

    return data;
  },

  async createTodayBalance(): Promise<DailyBalance> {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    // Get yesterday's closing balance
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const { data: yesterdayBalance } = await supabase
      .from('daily_balances')
      .select('cash_balance, bank_balance')
      .eq('date', yesterdayStr)
      .single();

    const openingCash = yesterdayBalance?.cash_balance || 0;

    const { data, error } = await supabase
      .from('daily_balances')
      .insert({
        date: today,
        cash_balance: openingCash,
        bank_balance: yesterdayBalance?.bank_balance || 0,
        opening_cash: openingCash
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCashBalance(amount: number): Promise<void> {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('daily_balances')
      .update({ cash_balance: amount })
      .eq('date', today);

    if (error) throw error;
  },

  async updateBankBalance(amount: number): Promise<void> {
    const supabase = createClient();
    const today = new Date().toISOString().split('T')[0];

    const { error } = await supabase
      .from('daily_balances')
      .update({ bank_balance: amount })
      .eq('date', today);

    if (error) throw error;
  }
};

export const expenseService = {
  async getExpenses(params: {
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ data: Expense[]; total: number }> {
    const supabase = createClient();
    const { page = 1, limit = 20, startDate, endDate } = params;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('expenses')
      .select('*', { count: 'exact' });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    if (endDate) {
      query = query.lte('created_at', endDate + 'T23:59:59');
    }

    const { data, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return {
      data: data || [],
      total: count || 0
    };
  },

  async createExpense(expense: Partial<Expense>): Promise<Expense> {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('expenses')
      .insert(expense)
      .select()
      .single();

    if (error) throw error;

    // Update daily balance
    const today = new Date().toISOString().split('T')[0];
    const { data: balance } = await supabase
      .from('daily_balances')
      .select('cash_balance, bank_balance')
      .eq('date', today)
      .single();

    if (balance) {
      const updateField = expense.payment_method === 'cash'
        ? { cash_balance: Number(balance.cash_balance) - Number(expense.amount) }
        : { bank_balance: Number(balance.bank_balance) - Number(expense.amount) };

      await supabase
        .from('daily_balances')
        .update(updateField)
        .eq('date', today);
    }

    return data;
  },

  async updateExpense(id: string, expense: Partial<Expense>): Promise<Expense> {
    const supabase = createClient();

    // Get old expense to calculate difference
    const { data: oldExpense } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    const { data, error } = await supabase
      .from('expenses')
      .update(expense)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Update balance if amount or payment method changed
    if (oldExpense && (oldExpense.amount !== expense.amount || oldExpense.payment_method !== expense.payment_method)) {
      const today = new Date().toISOString().split('T')[0];
      const { data: balance } = await supabase
        .from('daily_balances')
        .select('cash_balance, bank_balance')
        .eq('date', today)
        .single();

      if (balance) {
        // Reverse old expense
        const oldField = oldExpense.payment_method === 'cash'
          ? { cash_balance: Number(balance.cash_balance) + Number(oldExpense.amount) }
          : { bank_balance: Number(balance.bank_balance) + Number(oldExpense.amount) };

        // Apply new expense
        const newAmount = expense.amount || oldExpense.amount;
        const newMethod = expense.payment_method || oldExpense.payment_method;
        const newField = newMethod === 'cash'
          ? { cash_balance: Number(balance.cash_balance) - Number(newAmount) }
          : { bank_balance: Number(balance.bank_balance) - Number(newAmount) };

        await supabase
          .from('daily_balances')
          .update({ ...oldField, ...newField })
          .eq('date', today);
      }
    }

    return data;
  },

  async deleteExpense(id: string): Promise<void> {
    const supabase = createClient();

    // Get expense to reverse balance
    const { data: expense } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', id)
      .single();

    const { error } = await supabase
      .from('expenses')
      .delete()
      .eq('id', id);

    if (error) throw error;

    // Reverse balance
    if (expense) {
      const today = new Date().toISOString().split('T')[0];
      const { data: balance } = await supabase
        .from('daily_balances')
        .select('cash_balance, bank_balance')
        .eq('date', today)
        .single();

      if (balance) {
        const updateField = expense.payment_method === 'cash'
          ? { cash_balance: Number(balance.cash_balance) + Number(expense.amount) }
          : { bank_balance: Number(balance.bank_balance) + Number(expense.amount) };

        await supabase
          .from('daily_balances')
          .update(updateField)
          .eq('date', today);
      }
    }
  }
};