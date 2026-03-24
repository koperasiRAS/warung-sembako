import { createClient, getProfile, getUser } from '@/lib/supabase/server';
import { AlertTriangle, Package } from 'lucide-react';
import { SalesChart, ResetDataComponent } from '@/components/dashboard';
import Link from 'next/link';
import { Suspense } from 'react';

// Caching configuration - revalidates every 30 seconds
export const revalidate = 30;

async function getDailyBalance() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Get today's balance from daily_balances table
  const { data: balance } = await supabase
    .from('daily_balances')
    .select('cash_balance, bank_balance, opening_cash')
    .eq('date', today)
    .single();

  return balance || { cash_balance: 0, bank_balance: 0, opening_cash: 0 };
}

async function getTodayTransactions() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Get today's completed transactions
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, total, payment_method')
    .eq('status', 'completed')
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`);

  if (error || !transactions) {
    console.error('Error fetching transactions:', error);
    return { todaySales: 0, todayTransactions: 0, todayProfit: 0 };
  }

  const todaySales = transactions.reduce((sum, t) => sum + t.total, 0);
  const todayTransactions = transactions.length;

  // Calculate Profit
  const transactionIds = transactions.map(t => t.id);
  let todayProfit = todaySales; // Defaults to sales if COGS calculation fails
  
  if (transactionIds.length > 0) {
    // Get all items in today's transactions
    const { data: items } = await supabase
      .from('transaction_items')
      .select('qty, product:products(cost_price)')
      .in('transaction_id', transactionIds);
      
    if (items) {
      const totalCOGS = items.reduce((sum, item) => {
        // @ts-ignore - Supabase nested relationship typing can be tricky
        const costPrice = item.product?.cost_price || 0;
        return sum + (item.qty * costPrice);
      }, 0);
      todayProfit = todaySales - totalCOGS;
    }
  }

  return { todaySales, todayTransactions, todayProfit };
}

async function getUnpaidDebts() {
  const supabase = await createClient();
  const { data: debts, error } = await supabase
    .from('debts')
    .select('remaining_amount')
    .in('status', ['unpaid', 'partial']);

  if (error || !debts) {
    console.error('Error fetching unpaid debts:', error);
    return 0;
  }

  return debts.reduce((sum, debt) => sum + debt.remaining_amount, 0);
}

async function getLowStockProducts() {
  const supabase = await createClient();

  // Use RPC to get products where stock < low_stock_threshold (or default 10)
  const { data, error } = await supabase.rpc('get_low_stock_products', { limit_count: 5 });

  if (error) {
    console.error('Error fetching low stock products:', error);
    return [];
  }

  return data || [];
}

async function getSalesTrend() {
  const supabase = await createClient();

  // Get last 7 days of sales data
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('transactions')
    .select('total, created_at')
    .eq('status', 'completed')
    .gte('created_at', `${startDate}T00:00:00`);

  if (error) {
    console.error('Error fetching sales trend:', error);
    return [];
  }

  // Group by date
  const salesByDate: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];
    salesByDate[dateStr] = 0;
  }

  data?.forEach(t => {
    const dateStr = t.created_at.split('T')[0];
    if (salesByDate[dateStr] !== undefined) {
      salesByDate[dateStr] += t.total;
    }
  });

  // Convert to array format for chart
  return Object.entries(salesByDate)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getTodayExpenses() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: expenses, error } = await supabase
    .from('expenses')
    .select('amount')
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`);

  if (error || !expenses) {
    console.error('Error fetching expenses:', error);
    return 0;
  }

  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

async function getDashboardStats() {
  const [balance, transactions, lowStock, salesTrend, totalPiutang, todayExpenses] = await Promise.all([
    getDailyBalance(),
    getTodayTransactions(),
    getLowStockProducts(),
    getSalesTrend(),
    getUnpaidDebts(),
    getTodayExpenses(),
  ]);

  const todayGrossProfit = transactions.todayProfit;
  const todayNetProfit = todayGrossProfit - todayExpenses;
  const totalWarungBalance = balance.cash_balance + balance.bank_balance;

  return {
    todaySales: transactions.todaySales,
    todayTransactions: transactions.todayTransactions,
    todayGrossProfit,
    todayExpenses,
    todayNetProfit,
    cashBalance: balance.cash_balance,
    bankBalance: balance.bank_balance,
    totalWarungBalance,
    totalPiutang,
    lowStockProducts: lowStock,
    salesTrend,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
}

async function StatsCards() {
  const stats = await getDashboardStats();

  return (
    <>
      {/* Row 1 */}
      {/* Today's Sales */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Omset Hari Ini</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {formatCurrency(stats.todaySales)}
            </p>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Transaksi Hari Ini</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {stats.todayTransactions}
            </p>
          </div>
        </div>
      </div>

      {/* Saldo Total Warung */}
      <div className="bg-indigo-50 rounded-xl p-6 border border-indigo-100 shadow-sm col-span-2 relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-sm text-indigo-700 font-medium">Total Saldo Warung (Kas + Bank)</p>
            <p className="text-3xl font-bold text-indigo-900 mt-2">
              {formatCurrency(stats.totalWarungBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      {/* Laba Kotor */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Laba Kotor</p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">
              {formatCurrency(stats.todayGrossProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Pengeluaran */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Pengeluaran</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(stats.todayExpenses)}
            </p>
          </div>
        </div>
      </div>
      
      {/* Cash Balance */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Saldo Tunai</p>
            <p className="text-xl font-bold text-cash mt-1">
              {formatCurrency(stats.cashBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Bank Balance */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Saldo Bank</p>
            <p className="text-xl font-bold text-bank mt-1">
              {formatCurrency(stats.bankBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Row 3 */}
      {/* Net Profit */}
      <div className="bg-teal-50 rounded-xl p-6 border border-teal-100 shadow-sm col-span-2 relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-sm text-teal-800 font-medium">Laba Bersih Sebenarnya (Hari Ini)</p>
            <p className="text-2xl font-bold text-teal-700 mt-1">
              {formatCurrency(stats.todayNetProfit)}
            </p>
            <p className="text-xs text-teal-600/80 mt-1">Laba Kotor - Pengeluaran</p>
          </div>
        </div>
      </div>

      {/* Unpaid Debts */}
      <div className="bg-orange-50 rounded-xl p-6 border border-orange-100 shadow-sm col-span-2 relative overflow-hidden">
        <div className="flex items-center justify-between relative z-10">
          <div>
            <p className="text-sm text-orange-800 font-medium">Total Uang di Luar (Piutang)</p>
            <p className="text-2xl font-bold text-orange-700 mt-1">
              {formatCurrency(stats.totalPiutang)}
            </p>
            <p className="text-xs text-orange-600/80 mt-1">Kasbon pelanggan yang belum lunas</p>
          </div>
        </div>
      </div>
    </>
  );
}

async function SalesChartSection() {
  const stats = await getDashboardStats();

  return (
    <SalesChart
      data={stats.salesTrend}
      title="Grafik Penjualan (7 Hari Terakhir)"
    />
  );
}

export default async function DashboardPage() {
  const user = await getUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Beranda Admin</h1>
          <p className="text-slate-500 mt-1">
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
        <Link
          href="/pos"
          className="lg:hidden px-4 py-2 bg-secondary text-white rounded-lg font-medium"
        >
          Buka Kasir (POS)
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Suspense fallback={<div className="bg-white rounded-xl p-6 animate-pulse h-28 col-span-2 lg:col-span-4" />}>
          <StatsCards />
        </Suspense>
      </div>

      {/* Sales Chart */}
      <div className="mb-8">
        <Suspense fallback={<div className="bg-white rounded-xl p-6 animate-pulse h-56" />}>
          <SalesChartSection />
        </Suspense>
      </div>

      {/* Low Stock Products */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Stok Produk Menipis</h2>
          </div>
        </div>
        <Suspense
          fallback={
            <div className="p-6 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          }
        >
          <LowStockList />
        </Suspense>
      </div>

      {profile?.role === 'owner' && (
        <ResetDataComponent />
      )}
    </div>
  );
}

async function LowStockList() {
  const supabase = await createClient();

  const { data } = await supabase.rpc('get_low_stock_products', { limit_count: 5 });
  const lowStock = (data || []) as Array<{ id: string; name: string; stock: number; low_stock_threshold: number; price: number; image_url: string | null; [key: string]: unknown }>;

  if (!lowStock || lowStock.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p>Semua produk masih tersedia dengan baik</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {(lowStock ?? []).map((product) => (
        <div
          key={product.id}
          className="p-4 flex items-center justify-between hover:bg-slate-50"
        >
          <div className="flex items-center gap-4">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
            )}
            <div>
              <p className="font-medium text-slate-800">{product.name}</p>
              <p className="text-sm text-slate-500">
                {product.barcode ? `SKU: ${product.barcode}` : 'Tidak ada barcode'}
              </p>
            </div>
          </div>
          <div className="text-right">
            {product.stock === 0 ? (
              <span className="inline-block px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-bold mb-1">Stok Habis!</span>
            ) : (
              <p className="font-semibold text-amber-600">Sisa {product.stock}</p>
            )}
            <br />
            <Link
              href={`/products?edit=${product.id}`}
              className="text-sm text-primary hover:underline"
            >
              Isi Ulang
            </Link>
          </div>
        </div>
      ))}
      
    </div>
  );
}
