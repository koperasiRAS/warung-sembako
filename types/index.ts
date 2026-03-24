// Product types
export interface Product {
  id: string;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
  category_id: string | null;
  barcode: string | null;
  sku: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  category?: Category;
}

// Category types
export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

// Cart types
export interface CartItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
}

// Transaction types
export interface Transaction {
  id: string;
  total: number;
  payment_method: 'cash' | 'qris' | 'transfer' | 'hutang';
  cashier_id: string;
  status: 'completed' | 'voided';
  created_at: string;
  cashier?: Profile;
}

export interface TransactionItem {
  id: string;
  transaction_id: string;
  product_id: string;
  product_name?: string;
  product?: { name: string };
  qty: number;
  price: number;
  created_at: string;
}

// Expense types
export interface Expense {
  id: string;
  title: string;
  amount: number;
  payment_method: 'cash' | 'bank';
  note: string | null;
  created_at: string;
}

// User/Profile types
export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'owner' | 'cashier';
  created_at: string;
}

// Balance types
export interface DailyBalance {
  id: string;
  date: string;
  cash_balance: number;
  bank_balance: number;
  opening_cash: number;
  created_at: string;
  updated_at: string;
}

// Dashboard stats types
export interface DashboardStats {
  todaySales: number;
  todayTransactions: number;
  cashBalance: number;
  bankBalance: number;
  lowStockProducts: Product[];
  salesData: { date: string; value: number }[];
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}