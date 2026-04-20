import { createClient, getUser, getProfile } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { TrendingUp, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getReportData() {
  const supabase = await createClient();
  const today = new Date().toISOString().split('T')[0];
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const monthStart = startOfMonth.toISOString().split('T')[0];

  // Today's stats
  const { data: todayTransactions } = await supabase
    .from('transactions')
    .select('total, payment_method')
    .eq('status', 'completed')
    .gte('created_at', `${today}T00:00:00`)
    .lt('created_at', `${today}T23:59:59`);

  const todaySales = todayTransactions?.reduce((sum, t) => sum + t.total, 0) || 0;
  const todayCount = todayTransactions?.length || 0;
  const todayCash = todayTransactions
    ?.filter((t) => t.payment_method === 'cash')
    .reduce((sum, t) => sum + t.total, 0) || 0;
  const todayNonCash = todayTransactions
    ?.filter((t) => t.payment_method === 'qris' || t.payment_method === 'transfer')
    .reduce((sum, t) => sum + t.total, 0) || 0;
  // Outstanding hutang — query from debts table (remaining_amount)
  // This reflects what's actually still unpaid, not the original transaction value
  const { data: allDebts } = await supabase
    .from('debts')
    .select('remaining_amount, created_at');

  const todayStart = `${today}T00:00:00`;
  const todayEnd = `${today}T23:59:59`;

  const todayOutstanding = allDebts
    ?.filter(d => d.created_at >= todayStart && d.created_at <= todayEnd)
    .reduce((sum, d) => sum + d.remaining_amount, 0) || 0;

  // Monthly stats
  const { data: monthTransactions } = await supabase
    .from('transactions')
    .select('id, total, payment_method')
    .eq('status', 'completed')
    .gte('created_at', `${monthStart}T00:00:00`);

  const monthSales = monthTransactions?.reduce((sum, t) => sum + t.total, 0) || 0;
  const monthCount = monthTransactions?.length || 0;
  const monthHutang = monthTransactions
    ?.filter((t) => t.payment_method === 'hutang')
    .reduce((sum, t) => sum + t.total, 0) || 0;

  // Outstanding bulan ini — sum of remaining_amount from debts table (what's truly unpaid)
  const monthStartTime = `${monthStart}T00:00:00`;
  const monthOutstanding = allDebts
    ?.filter(d => d.created_at >= monthStartTime)
    .reduce((sum, d) => sum + d.remaining_amount, 0) || 0;

  let monthCOGS = 0;
  if (monthTransactions && monthTransactions.length > 0) {
    const monthTxIds = monthTransactions.map(t => t.id);
    const { data: monthItems } = await supabase
      .from('transaction_items')
      .select('qty, product:products(cost_price)')
      .in('transaction_id', monthTxIds);
      
    if (monthItems) {
      monthCOGS = monthItems.reduce((sum, item) => {
        // @ts-ignore
        const costPrice = item.product?.cost_price || 0;
        return sum + (item.qty * costPrice);
      }, 0);
    }
  }

  // Expenses this month
  const { data: monthExpenses } = await supabase
    .from('expenses')
    .select('amount, payment_method')
    .gte('created_at', `${monthStart}T00:00:00`);

  const monthExpensesTotal = monthExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

  const grossProfit = monthSales - monthCOGS;
  const netProfit = grossProfit - monthExpensesTotal;

  return {
    today: { sales: todaySales, count: todayCount, cash: todayCash, nonCash: todayNonCash, outstandingHutang: todayOutstanding },
    month: {
      sales: monthSales,
      count: monthCount,
      expenses: monthExpensesTotal,
      cogs: monthCOGS,
      grossProfit,
      netProfit,
      hutang: monthHutang,
      outstandingHutang: monthOutstanding,
    },
  };
}

export default async function ReportsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/pin');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner' && profile?.role !== 'cashier') {
    redirect('/pos');
  }

  const report = await getReportData();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div style={{ padding: 'var(--space-4)' }} className="lg:p-8">
      {/* Header */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h1 style={{
          fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)',
          fontWeight: '700', color: 'var(--color-on-surface)',
        }}>
          Laporan Keuangan
        </h1>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)',
          color: 'var(--color-outline)', marginTop: 'var(--space-1)',
        }}>
          Ringkasan statistik penjualan bulanan dan harian
        </p>
      </div>

      {/* Today's Summary */}
      <div style={{ marginBottom: 'var(--space-8)' }}>
        <h2 style={{
          fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
          fontWeight: '600', color: 'var(--color-on-surface)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}>
          <Calendar style={{ width: '1.25rem', height: '1.25rem' }} />
          Ringkasan Hari Ini
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }} className="lg:grid-cols-4">
          {[
            { label: 'Total Penjualan', value: report.today.sales, count: report.today.count, color: 'var(--color-on-surface)', countColor: 'var(--color-tertiary)' },
            { label: 'Tunai (Cash)', value: report.today.cash, color: 'var(--color-cash)' },
            { label: 'Non-Tunai', value: report.today.nonCash, color: 'var(--color-bank)' },
            { label: 'Piutang Belum Lunas', value: report.today.outstandingHutang, color: 'var(--color-warning)' },
          ].map((card) => (
            <div key={card.label} style={{
              backgroundColor: 'var(--color-surface-container-lowest)',
              borderRadius: 'var(--radius-xl)',
              padding: 'var(--space-6)',
              border: '1px solid var(--color-outline-variant)',
            }}>
              <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>
                {card.label}
              </p>
              <p style={{
                fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
                fontWeight: '700', color: card.color, marginTop: 'var(--space-1)',
              }}>
                {formatCurrency(card.value)}
              </p>
              {card.count !== undefined && (
                <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: card.countColor, marginTop: 'var(--space-2)' }}>
                  {card.count} transaksi
                </p>
              )}
            </div>
          ))}

          {/* Rata-rata transaksi */}
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>
              Rata-rata Transaksi
            </p>
            <p style={{
              fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
              fontWeight: '700', color: 'var(--color-on-surface)', marginTop: 'var(--space-1)',
            }}>
              {report.today.count > 0 ? formatCurrency(report.today.sales / report.today.count) : formatCurrency(0)}
            </p>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div>
        <h2 style={{
          fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
          fontWeight: '600', color: 'var(--color-on-surface)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
          marginBottom: 'var(--space-4)',
        }}>
          <TrendingUp style={{ width: '1.25rem', height: '1.25rem' }} />
          Bulan Ini
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }} className="lg:grid-cols-4">
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>Penjualan Kotor (Omzet)</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-primary)', marginTop: 'var(--space-1)' }}>
              {formatCurrency(report.month.sales)}
            </p>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-2)' }}>
              {report.month.count} transaksi
            </p>
          </div>

          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>Harga Pokok Penjualan (HPP)</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-on-surface-variant)', marginTop: 'var(--space-1)' }}>
              {formatCurrency(report.month.cogs)}
            </p>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-tertiary)', marginTop: 'var(--space-2)' }}>
              Laba Kotor: {formatCurrency(report.month.grossProfit)}
            </p>
          </div>

          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-outline-variant)',
          }}>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>Total Pengeluaran / Biaya</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-error)', marginTop: 'var(--space-1)' }}>
              {formatCurrency(report.month.expenses)}
            </p>
          </div>

          <div style={{
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-warning-bg)',
            backgroundColor: 'var(--color-warning-bg)',
          }}>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '500', color: 'var(--color-warning)', marginBottom: 'var(--space-1)' }}>
              Piutang Belum Lunas (Bulan Ini)
            </p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-warning)', marginTop: 'var(--space-1)' }}>
              {formatCurrency(report.month.outstandingHutang)}
            </p>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', color: 'var(--color-warning)', marginTop: 'var(--space-1)' }}>
              Sisa utang pelanggan yang belum dibayar lunas
            </p>
          </div>

          <div style={{
            borderRadius: 'var(--radius-xl)',
            padding: 'var(--space-6)',
            border: '1px solid var(--color-tertiary-fixed)',
            backgroundColor: 'var(--color-tertiary-fixed)',
            gridColumn: 'span 2',
          }} className="lg:grid-cols-1">
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '500', color: 'var(--color-tertiary)', marginBottom: 'var(--space-1)' }}>
              Laba Bersih (Net Profit)
            </p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-tertiary)', marginTop: 'var(--space-1)' }}>
              {formatCurrency(report.month.netProfit)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
