export type UserRole = 'owner' | 'cashier';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  stock: number;
  category_id: string | null;
  barcode: string | null;
  sku: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

export interface Transaction {
  id: string;
  total: number;
  payment_method: 'cash' | 'qris' | 'transfer';
  cashier_id: string;
  status: 'completed' | 'voided';
  created_at: string;
  cashier?: Profile;
  items?: TransactionItem[];
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  qty: number;
  price: number;
  created_at: string;
  product?: Product;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  payment_method: 'cash' | 'bank';
  note: string | null;
  created_at: string;
}

export interface DailyBalance {
  id: string;
  date: string;
  cash_balance: number;
  bank_balance: number;
  opening_cash: number;
  created_at: string;
  updated_at: string;
}

export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  cashBalance: number;
  bankBalance: number;
  lowStockProducts: Product[];
}

export interface CartItem {
  product: Product;
  qty: number;
}
