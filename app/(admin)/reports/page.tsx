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
  const todayHutang = todayTransactions
    ?.filter((t) => t.payment_method === 'hutang')
    .reduce((sum, t) => sum + t.total, 0) || 0;

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
    today: { sales: todaySales, count: todayCount, cash: todayCash, nonCash: todayNonCash, hutang: todayHutang },
    month: { 
      sales: monthSales, 
      count: monthCount, 
      expenses: monthExpensesTotal, 
      cogs: monthCOGS, 
      grossProfit, 
      netProfit,
      hutang: monthHutang
    },
  };
}

export default async function ReportsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
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
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Laporan Keuangan</h1>
        <p className="text-slate-500 mt-1">Ringkasan statistik penjualan bulanan dan harian</p>
      </div>

      {/* Today's Summary */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Ringkasan Hari Ini
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Penjualan</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {formatCurrency(report.today.sales)}
                </p>
              </div>
            </div>
            <p className="text-sm text-green-600 mt-2">
              {report.today.count} transaksi
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Tunai (Cash)</p>
                <p className="text-2xl font-bold text-cash mt-1">
                  {formatCurrency(report.today.cash)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Non-Tunai</p>
                <p className="text-2xl font-bold text-bank mt-1">
                  {formatCurrency(report.today.nonCash)}
                </p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Kasbon (Piutang)</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {formatCurrency(report.today.hutang)}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Rata-rata Transaksi</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {report.today.count > 0
                    ? formatCurrency(report.today.sales / report.today.count)
                    : formatCurrency(0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Bulan Ini
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <p className="text-sm text-slate-500">Penjualan Kotor (Omzet)</p>
            <p className="text-2xl font-bold text-primary mt-1">
              {formatCurrency(report.month.sales)}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {report.month.count} transaksi
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <p className="text-sm text-slate-500">Harga Pokok Penjualan (HPP)</p>
            <p className="text-2xl font-bold text-slate-600 mt-1">
              {formatCurrency(report.month.cogs)}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              Laba Kotor: {formatCurrency(report.month.grossProfit)}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <p className="text-sm text-slate-500">Total Pengeluaran / Biaya</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(report.month.expenses)}
            </p>
          </div>

          <div className="rounded-xl p-6 border border-orange-200 bg-orange-50">
            <p className="text-sm text-orange-800 font-medium">Omzet via Kasbon (Bulan Ini)</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {formatCurrency(report.month.hutang)}
            </p>
            <p className="text-xs text-orange-700 mt-1">
              Nilai barang terjual tapi belum dibayar lunas
            </p>
          </div>

          <div className="rounded-xl p-6 border border-teal-100 bg-teal-50 col-span-2 lg:col-span-1">
            <p className="text-sm text-teal-800 font-medium">Laba Bersih (Net Profit)</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">
              {formatCurrency(report.month.netProfit)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
