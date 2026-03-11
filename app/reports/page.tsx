import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { getUser, getProfile } from '@/lib/supabase/server';
import { DollarSign, TrendingUp, Calendar, ArrowUpRight } from 'lucide-react';

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
    ?.filter((t) => t.payment_method !== 'cash')
    .reduce((sum, t) => sum + t.total, 0) || 0;

  // Monthly stats
  const { data: monthTransactions } = await supabase
    .from('transactions')
    .select('total, payment_method')
    .eq('status', 'completed')
    .gte('created_at', `${monthStart}T00:00:00`);

  const monthSales = monthTransactions?.reduce((sum, t) => sum + t.total, 0) || 0;
  const monthCount = monthTransactions?.length || 0;

  // Expenses this month
  const { data: monthExpenses } = await supabase
    .from('expenses')
    .select('amount, payment_method')
    .gte('created_at', `${monthStart}T00:00:00`);

  const monthExpensesTotal = monthExpenses?.reduce((sum, e) => sum + e.amount, 0) || 0;

  return {
    today: { sales: todaySales, count: todayCount, cash: todayCash, nonCash: todayNonCash },
    month: { sales: monthSales, count: monthCount, expenses: monthExpensesTotal },
  };
}

export default async function ReportsPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  const profile = await getProfile(user.id);

  if (profile?.role !== 'owner') {
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
        <h1 className="text-2xl font-bold text-slate-800">Reports</h1>
        <p className="text-slate-500 mt-1">Financial overview and statistics</p>
      </div>

      {/* Today's Summary */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Today&apos;s Summary
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Total Sales</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {formatCurrency(report.today.sales)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            <p className="text-sm text-green-600 mt-2">
              {report.today.count} transactions
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Cash</p>
                <p className="text-2xl font-bold text-cash mt-1">
                  {formatCurrency(report.today.cash)}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-cash" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Non-Cash</p>
                <p className="text-2xl font-bold text-bank mt-1">
                  {formatCurrency(report.today.nonCash)}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-bank" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Avg. Transaction</p>
                <p className="text-2xl font-bold text-slate-800 mt-1">
                  {report.today.count > 0
                    ? formatCurrency(report.today.sales / report.today.count)
                    : formatCurrency(0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Summary */}
      <div>
        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          This Month
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <p className="text-sm text-slate-500">Monthly Sales</p>
            <p className="text-2xl font-bold text-primary mt-1">
              {formatCurrency(report.month.sales)}
            </p>
            <p className="text-sm text-slate-500 mt-2">
              {report.month.count} transactions
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <p className="text-sm text-slate-500">Monthly Expenses</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {formatCurrency(report.month.expenses)}
            </p>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <p className="text-sm text-slate-500">Net Profit</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {formatCurrency(report.month.sales - report.month.expenses)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
