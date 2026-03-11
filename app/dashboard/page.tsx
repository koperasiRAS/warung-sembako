import { createClient } from '@/lib/supabase/server';
import { DollarSign, Receipt, Wallet, AlertTriangle, RefreshCw, Package } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

// Force dynamic to avoid caching issues
export const dynamic = 'force-dynamic';

async function getDashboardStats() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  // Get today's transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('total, payment_method')
    .eq('status', 'completed')
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`);

  const todaySales = transactions?.reduce((sum, t) => sum + t.total, 0) || 0;
  const todayTransactions = transactions?.length || 0;

  // Calculate cash and bank balance from today's transactions
  const cashBalance = transactions
    ?.filter(t => t.payment_method === 'cash')
    .reduce((sum, t) => sum + t.total, 0) || 0;

  const bankBalance = transactions
    ?.filter(t => t.payment_method !== 'cash')
    .reduce((sum, t) => sum + t.total, 0) || 0;

  // Get low stock products (less than 10)
  const { data: lowStock } = await supabase
    .from('products')
    .select('*')
    .lt('stock', 10)
    .order('stock', { ascending: true })
    .limit(5);

  return {
    todaySales,
    todayTransactions,
    cashBalance,
    bankBalance,
    lowStockProducts: lowStock || [],
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
      {/* Today's Sales */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Today&apos;s Sales</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {formatCurrency(stats.todaySales)}
            </p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Today&apos;s Transactions</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {stats.todayTransactions}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
            <Receipt className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      {/* Cash Balance */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Cash Balance</p>
            <p className="text-2xl font-bold text-cash mt-1">
              {formatCurrency(stats.cashBalance)}
            </p>
          </div>
          <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
            <Wallet className="w-6 h-6 text-cash" />
          </div>
        </div>
      </div>

      {/* Bank Balance */}
      <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Bank Balance</p>
            <p className="text-2xl font-bold text-bank mt-1">
              {formatCurrency(stats.bankBalance)}
            </p>
          </div>
          <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
            <Wallet className="w-6 h-6 text-bank" />
          </div>
        </div>
      </div>
    </>
  );
}

export default function DashboardPage() {
  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
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
          Open POS
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
        <Suspense fallback={<div className="bg-white rounded-xl p-6 animate-pulse h-28" />}>
          <StatsCards />
        </Suspense>
      </div>

      {/* Low Stock Products */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="font-semibold text-slate-800">Low Stock Products</h2>
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
    </div>
  );
}

async function LowStockList() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: lowStock } = await supabase
    .from('products')
    .select('*')
    .lt('stock', 10)
    .gt('stock', 0)
    .order('stock', { ascending: true })
    .limit(5);

  if (!lowStock || lowStock.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        <p>All products are well stocked</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-slate-100">
      {lowStock.map((product) => (
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
                {product.barcode ? `SKU: ${product.barcode}` : 'No barcode'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-semibold text-amber-600">{product.stock} left</p>
            <Link
              href={`/products?edit=${product.id}`}
              className="text-sm text-primary hover:underline"
            >
              Restock
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
