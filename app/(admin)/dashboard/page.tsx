import { createClient, getProfile, getUser } from '@/lib/supabase/server';
import { AlertTriangle, Package } from 'lucide-react';
import { SalesChart, ResetDataComponent, DashboardRealtime } from '@/components/dashboard';
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

async function StatsGrid() {
  const s = await getDashboardStats();

  const cardBase: React.CSSProperties = {
    backgroundColor: 'var(--color-surface-container-lowest)',
    borderRadius: 'var(--radius-xl)',
    padding: '1.5rem',
    boxShadow: 'var(--shadow-sm)',
    border: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'var(--font-label)',
    fontSize: 'var(--text-label-md)',
    color: 'var(--color-on-surface-variant)',
    letterSpacing: 'var(--tracking-wide)',
    textTransform: 'uppercase' as const,
  };

  const moneyStyle = (color: string): React.CSSProperties => ({
    fontFamily: 'var(--font-heading)',
    fontSize: 'var(--text-headline-md)',
    fontWeight: '700',
    color,
    marginTop: '0.25rem',
    letterSpacing: 'var(--tracking-tight)',
  });

  return (
    <>
      {/* Row 1 — 4 cards */}
      {/* Omset */}
      <div style={cardBase}>
        <p style={labelStyle}>Omset Hari Ini</p>
        <p style={moneyStyle('var(--color-on-surface)')}>{formatCurrency(s.todaySales)}</p>
      </div>

      {/* Transaksi */}
      <div style={cardBase}>
        <p style={labelStyle}>Transaksi Hari Ini</p>
        <p style={moneyStyle('var(--color-on-surface)')}>{s.todayTransactions}</p>
      </div>

      {/* Saldo Tunai */}
      <div style={cardBase}>
        <p style={labelStyle}>Saldo Tunai</p>
        <p style={moneyStyle('var(--color-primary)')}>{formatCurrency(s.cashBalance)}</p>
      </div>

      {/* Saldo Bank */}
      <div style={cardBase}>
        <p style={labelStyle}>Saldo Bank</p>
        <p style={moneyStyle('var(--color-primary)')}>{formatCurrency(s.bankBalance)}</p>
      </div>

      {/* Row 2 — highlighted full-width cards */}
      {/* Total Warung */}
      <div style={{
        ...cardBase,
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-container) 100%)',
        gridColumn: 'span 2',
      }}>
        <p style={{ ...labelStyle, color: 'rgba(255,255,255,0.7)' }}>Total Saldo Warung</p>
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-display-sm)',
          fontWeight: '800',
          color: 'var(--color-on-primary)',
          letterSpacing: 'var(--tracking-tight)',
          marginTop: '0.25rem',
        }}>
          {formatCurrency(s.totalWarungBalance)}
        </p>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'rgba(255,255,255,0.6)', marginTop: '0.25rem' }}>
          Kas + Bank
        </p>
      </div>

      {/* Laba Kotor */}
      <div style={cardBase}>
        <p style={labelStyle}>Laba Kotor</p>
        <p style={moneyStyle('var(--color-tertiary)')}>{formatCurrency(s.todayGrossProfit)}</p>
      </div>

      {/* Pengeluaran */}
      <div style={cardBase}>
        <p style={labelStyle}>Pengeluaran</p>
        <p style={moneyStyle('var(--color-error)')}>{formatCurrency(s.todayExpenses)}</p>
      </div>

      {/* Row 3 — bottom cards */}
      {/* Laba Bersih */}
      <div style={{
        ...cardBase,
        backgroundColor: 'var(--color-surface-container)',
        gridColumn: 'span 2',
      }}>
        <p style={labelStyle}>Laba Bersih</p>
        <p style={moneyStyle('var(--color-on-surface)')}>{formatCurrency(s.todayNetProfit)}</p>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-on-surface-variant)', marginTop: '0.25rem' }}>
          Laba Kotor − Pengeluaran
        </p>
      </div>

      {/* Piutang */}
      <div style={{
        ...cardBase,
        backgroundColor: 'var(--color-surface-container)',
        gridColumn: 'span 2',
      }}>
        <p style={labelStyle}>Piutang</p>
        <p style={moneyStyle('var(--color-on-surface)')}>{formatCurrency(s.totalPiutang)}</p>
        <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-on-surface-variant)', marginTop: '0.25rem' }}>
          Kasbon pelanggan belum lunas
        </p>
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
  const lowStock = (data || []) as Array<{ id: string; name: string; stock: number; low_stock_threshold: number; price: number; image_url: string | null; [key: string]: unknown }>;

  if (!lowStock || lowStock.length === 0) {
    return (
      <div style={{ padding: '1.5rem', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>
          Semua produk masih tersedia dengan baik
        </p>
      </div>
    );
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--color-outline-variant)',
    backgroundColor: 'var(--color-surface-container-lowest)',
  };

  return (
    <div>
      {lowStock.map((product, i) => (
        <div key={product.id} style={{
          ...rowStyle,
          borderBottom: i === lowStock.length - 1 ? 'none' : '1px solid var(--color-outline-variant)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {product.image_url ? (
              <img src={product.image_url} alt={product.name}
                style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', objectFit: 'cover', backgroundColor: 'var(--color-surface-dim)' }} />
            ) : (
              <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-surface-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={24} color="var(--color-outline)" />
              </div>
            )}
            <div>
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-on-surface)' }}>{product.name}</p>
              <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>
                {product.barcode ? `SKU: ${product.barcode}` : 'Tidak ada barcode'}
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            {product.stock === 0 ? (
              <span style={{
                display: 'inline-block', padding: '2px 8px',
                backgroundColor: 'var(--color-error-container)', color: 'var(--color-on-error-container)',
                borderRadius: 'var(--radius-full)', fontSize: 'var(--text-label-sm)', fontWeight: '600',
              }}>Stok Habis!</span>
            ) : (
              <p style={{ fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-tertiary)' }}>
                Sisa {product.stock}
              </p>
            )}
            <Link href={`/products?edit=${product.id}`}
              style={{
                display: 'inline-block', marginTop: '4px',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                color: 'var(--color-primary)', textDecoration: 'none',
              }}>
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
    <div style={{ padding: 'var(--space-8)', backgroundColor: 'var(--color-background)', minHeight: '100dvh' }}>
      <DashboardRealtime />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 'var(--space-8)',
      }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-md)',
            fontWeight: '700', color: 'var(--color-on-background)',
            letterSpacing: 'var(--tracking-tight)',
          }}>
            Beranda Admin
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)',
            color: 'var(--color-on-surface-variant)', marginTop: '0.25rem',
          }}>
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <Link href="/pos" style={{
          display: 'none',
          fontFamily: 'var(--font-label)', fontWeight: '600',
          padding: '0.625rem 1.25rem',
          background: 'var(--gradient-primary)', color: 'var(--color-on-primary)',
          borderRadius: 'var(--radius-full)', textDecoration: 'none',
        }} className="mobile-pos-btn">
          Buka Kasir
        </Link>
        <style>{`.mobile-pos-btn { display: inline-flex; } @media (min-width: 1024px) { .mobile-pos-btn { display: none; } }`}</style>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-8)',
      }}>
        <Suspense fallback={<div style={{ gridColumn: '1/-1', height: '120px', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--color-surface-container-lowest)' }} />}>
          <StatsGrid />
        </Suspense>
      </div>

      {/* Sales Chart */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <Suspense fallback={<div style={{ height: '220px', borderRadius: 'var(--radius-xl)', backgroundColor: 'var(--color-surface-container-lowest)' }} />}>
          <SalesChartSection />
        </Suspense>
      </div>

      {/* Low Stock */}
      <div style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-sm)',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
        }}>
          <AlertTriangle size={20} color="var(--color-warning)" />
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-md)',
            fontWeight: '600', color: 'var(--color-on-surface)',
          }}>
            Stok Produk Menipis
          </h2>
        </div>
        <Suspense fallback={<div style={{ padding: '1.5rem', backgroundColor: 'var(--color-surface-container-lowest)' }} />}>
          <LowStockList />
        </Suspense>
      </div>

      {profile?.role === 'owner' && <ResetDataComponent />}
    </div>
  );
}
