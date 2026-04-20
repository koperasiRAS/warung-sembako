import { createClient, getProfile, getUser } from '@/lib/supabase/server';
import { AlertTriangle, Package, TrendingUp, Wallet, CreditCard, Banknote, Coins } from 'lucide-react';
import { SalesChart, ResetDataComponent, DashboardRealtime } from '@/components/dashboard';
import StatCard from '@/components/ui/StatCard';
import Link from 'next/link';
import { Suspense } from 'react';

export const revalidate = 0;

async function getDailyBalance() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
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
  const { data: transactions, error } = await supabase
    .from('transactions')
    .select('id, total, payment_method')
    .eq('status', 'completed')
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`);

  if (error || !transactions) return { todaySales: 0, todayTransactions: 0, todayProfit: 0 };

  const todaySales = transactions.reduce((sum, t) => sum + t.total, 0);
  const todayTransactions = transactions.length;
  const transactionIds = transactions.map(t => t.id);
  let todayProfit = todaySales;

  if (transactionIds.length > 0) {
    const { data: items } = await supabase
      .from('transaction_items')
      .select('qty, product:products(cost_price)')
      .in('transaction_id', transactionIds);
    if (items) {
      const totalCOGS = items.reduce((sum, item) => {
        // @ts-ignore
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
  const { data: debts } = await supabase
    .from('debts')
    .select('remaining_amount')
    .in('status', ['unpaid', 'partial']);
  if (!debts) return 0;
  return debts.reduce((sum, debt) => sum + debt.remaining_amount, 0);
}

async function getLowStockProducts() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_low_stock_products', { limit_count: 5 });
  return data || [];
}

async function getSalesTrend() {
  const supabase = await createClient();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  const startDate = sevenDaysAgo.toISOString().split('T')[0];
  const { data } = await supabase
    .from('transactions')
    .select('total, created_at')
    .eq('status', 'completed')
    .gte('created_at', `${startDate}T00:00:00`);

  const salesByDate: Record<string, number> = {};
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    salesByDate[d.toISOString().split('T')[0]] = 0;
  }
  data?.forEach(t => {
    const dateStr = t.created_at.split('T')[0];
    if (salesByDate[dateStr] !== undefined) salesByDate[dateStr] += t.total;
  });
  return Object.entries(salesByDate)
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

async function getTodayExpenses() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const { data: expenses } = await supabase
    .from('expenses')
    .select('amount')
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`);
  if (!expenses) return 0;
  return expenses.reduce((sum, e) => sum + e.amount, 0);
}

async function getDashboardStats() {
  const [balance, transactions, lowStock, salesTrend, totalPiutang, todayExpenses] = await Promise.all([
    getDailyBalance(), getTodayTransactions(), getLowStockProducts(),
    getSalesTrend(), getUnpaidDebts(), getTodayExpenses(),
  ]);
  return {
    todaySales: transactions.todaySales,
    todayTransactions: transactions.todayTransactions,
    todayGrossProfit: transactions.todayProfit,
    todayExpenses,
    todayNetProfit: transactions.todayProfit - todayExpenses,
    cashBalance: balance.cash_balance,
    bankBalance: balance.bank_balance,
    totalWarungBalance: balance.cash_balance + balance.bank_balance,
    totalPiutang,
    lowStockProducts: lowStock,
    salesTrend,
  };
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency', currency: 'IDR', minimumFractionDigits: 0,
  }).format(amount);
}

async function StatsGrid() {
  const s = await getDashboardStats();

  return (
    <>
      {/* Row 1 — 4 cards */}
      <StatCard label="Omset Hari Ini" value={formatCurrency(s.todaySales)} />
      <StatCard label="Transaksi" value={s.todayTransactions.toString()} />
      <StatCard
        label="Saldo Tunai"
        value={formatCurrency(s.cashBalance)}
        icon={Banknote}
        iconBg="bg-primary-fixed"
        iconColor="text-primary"
      />
      <StatCard
        label="Saldo Bank"
        value={formatCurrency(s.bankBalance)}
        icon={CreditCard}
        iconBg="bg-primary-fixed"
        iconColor="text-primary"
      />

      {/* Row 2 — Total Warung (full-width gradient) */}
      <div
        className="col-span-2 bg-gradient-to-br from-primary to-primary-container rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden ambient-shadow"
        style={{ gridColumn: 'span 2' }}
      >
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-xl" />
        <p className="text-[13px] font-medium font-body text-white/70">Total Saldo Warung</p>
        <div className="relative z-10">
          <h3 className="text-3xl font-extrabold font-headline text-white mb-1">
            {formatCurrency(s.totalWarungBalance)}
          </h3>
          <p className="text-sm font-medium font-body text-white/60">Kas + Bank</p>
        </div>
      </div>

      {/* Laba Kotor */}
      <StatCard
        label="Laba Kotor"
        value={formatCurrency(s.todayGrossProfit)}
        icon={TrendingUp}
        iconBg="bg-tertiary/10"
        iconColor="text-tertiary"
      />

      {/* Pengeluaran */}
      <StatCard
        label="Pengeluaran"
        value={formatCurrency(s.todayExpenses)}
        icon={Wallet}
        iconBg="bg-error-container"
        iconColor="text-error"
        variant="alert"
      />

      {/* Row 3 — Laba Bersih + Piutang */}
      <div
        className="col-span-2 bg-surface-container rounded-2xl p-6 flex flex-col justify-between ambient-shadow"
        style={{ gridColumn: 'span 2' }}
      >
        <p className="text-[13px] font-medium font-body text-on-surface-variant">Laba Bersih</p>
        <h3 className="text-3xl font-extrabold font-headline text-on-surface mb-1">
          {formatCurrency(s.todayNetProfit)}
        </h3>
        <p className="text-sm font-medium font-body text-outline">Laba Kotor − Pengeluaran</p>
      </div>

      <div
        className="col-span-2 bg-surface-container rounded-2xl p-6 flex flex-col justify-between ambient-shadow"
        style={{ gridColumn: 'span 2' }}
      >
        <p className="text-[13px] font-medium font-body text-on-surface-variant">Piutang</p>
        <h3 className="text-3xl font-extrabold font-headline text-on-surface mb-1">
          {formatCurrency(s.totalPiutang)}
        </h3>
        <p className="text-sm font-medium font-body text-outline">Kasbon pelanggan belum lunas</p>
      </div>
    </>
  );
}

async function SalesChartSection() {
  const s = await getDashboardStats();
  return <SalesChart data={s.salesTrend} title="Grafik Penjualan — 7 Hari Terakhir" />;
}

async function LowStockList() {
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_low_stock_products', { limit_count: 5 });
  const lowStock = (data || []) as Array<{ id: string; name: string; stock: number; low_stock_threshold: number; price: number; barcode: string | null; image_url: string | null; [key: string]: unknown }>;

  if (!lowStock || lowStock.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="font-body text-sm text-outline">Semua produk masih tersedia dengan baik</p>
      </div>
    );
  }

  return (
    <div>
      {lowStock.map((product, i) => (
        <div
          key={product.id}
          className={`
            flex items-center justify-between px-6 py-4
            bg-surface-container-lowest
            ${i !== lowStock.length - 1 ? 'border-b border-outline-variant/15' : ''}
          `}
        >
          <div className="flex items-center gap-4">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-12 h-12 rounded-2xl object-cover bg-surface-dim"
              />
            ) : (
              <div className="w-12 h-12 rounded-2xl bg-surface-dim flex items-center justify-center">
                <Package size={20} className="text-outline" />
              </div>
            )}
            <div>
              <p className="font-body text-sm font-semibold text-on-surface">{product.name}</p>
              <p className="font-label text-[12px] text-outline mt-0.5">
                {product.barcode ? `SKU: ${product.barcode}` : 'Tidak ada barcode'}
              </p>
            </div>
          </div>
          <div className="text-right">
            {product.stock === 0 ? (
              <span className="inline-block px-2 py-0.5 bg-error-container text-on-error-container rounded-full font-label text-xs font-semibold">
                Stok Habis!
              </span>
            ) : (
              <p className="font-body text-sm font-semibold text-tertiary">
                Sisa {product.stock}
              </p>
            )}
            <Link
              href={`/products?edit=${product.id}`}
              className="block font-label text-[12px] text-primary mt-1 hover:underline"
            >
              Isi Ulang
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const user = await getUser();
  const profile = user ? await getProfile(user.id) : null;

  return (
    <div className="min-h-dvh bg-background p-6 lg:p-8">
      <DashboardRealtime />

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-headline text-on-surface tracking-tight">
            Beranda Admin
          </h1>
          <p className="font-body text-sm text-on-surface-variant mt-0.5">
            {new Date().toLocaleDateString('id-ID', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <Link
          href="/pos"
          className="hidden lg:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-primary to-primary-container text-on-primary font-label text-sm font-semibold shadow-ambient hover:opacity-90 transition-opacity"
        >
          Buka Kasir
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Suspense fallback={
          <div className="col-span-full h-32 rounded-2xl bg-surface-container-lowest animate-pulse" />
        }>
          <StatsGrid />
        </Suspense>
      </div>

      {/* Sales Chart */}
      <div className="mb-8">
        <Suspense fallback={
          <div className="h-56 rounded-2xl bg-surface-container-lowest animate-pulse" />
        }>
          <SalesChartSection />
        </Suspense>
      </div>

      {/* Low Stock Alert */}
      <div className="bg-surface-container-lowest rounded-2xl ambient-shadow overflow-hidden mb-8">
        <div className="px-6 py-5 border-b border-outline-variant/15 flex items-center gap-2">
          <AlertTriangle size={18} className="text-warning" />
          <h2 className="font-headline text-base font-semibold text-on-surface">
            Stok Produk Menipis
          </h2>
        </div>
        <Suspense fallback={<div className="p-6" />}>
          <LowStockList />
        </Suspense>
      </div>

      {profile?.role === 'owner' && <ResetDataComponent />}
    </div>
  );
}