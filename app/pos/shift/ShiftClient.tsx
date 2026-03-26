'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { LogOut, ArrowLeft, Loader2, Printer, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';

interface ShiftData {
  cashierName: string;
  cashierId: string;
  date: string;
  totalSales: number;
  cashSales: number;
  nonCashSales: number;
  transactionCount: number;
  openingCash: number;
}

export default function ShiftClient({ initialData, openShiftId, reason }: { initialData: ShiftData; openShiftId?: string | null; reason?: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [actualCash, setActualCash] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isOpening, setIsOpening] = useState(reason === 'no_shift');
  const [isOpeningSubmitting, setIsOpeningSubmitting] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [openingCash, setOpeningCash] = useState<string>('');
  const [openingCashError, setOpeningCashError] = useState('');

  // Realtime: refresh page when new transactions are created during this shift
  useEffect(() => {
    if (!openShiftId) return;

    const channel = supabase
      .channel(`shift-txns-${openShiftId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `cashier_id=eq.${initialData.cashierId}`,
        },
        () => {
          // New transaction in this shift — refresh to show updated totals
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openShiftId, initialData.cashierId]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const expectedCash = initialData.cashSales;
  const actualCashNum = parseFloat(actualCash) || 0;
  const shiftOpeningCash = initialData.openingCash || 0;
  // Total uang yang seharusnya ada di laci = uang buka shift + penjualan cash
  const expectedCashWithOpening = shiftOpeningCash + expectedCash;
  const variance = actualCashNum - expectedCashWithOpening;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleOpenShift = async () => {
    // Guard against double-click — disable IMMEDIATELY before any async work
    if (isNavigating || isOpeningSubmitting) return;
    setIsNavigating(true);
    setIsOpeningSubmitting(true);
    setOpeningCashError('');

    const cash = Number.parseFloat(openingCash);
    if (Number.isNaN(cash) || cash < 0) {
      setOpeningCashError('Masukkan nominal laci yang valid');
      setIsNavigating(false);
      setIsOpeningSubmitting(false);
      return;
    }

    try {
      // 1. Open / get shift
      const { data, error } = await supabase.rpc('ensure_open_shift', {
        p_cashier_id: initialData.cashierId,
      });
      if (error || !data?.[0]?.id) {
        throw error || new Error('Gagal membuka shift');
      }
      const newShiftId = data[0].id;

      // 2. Save opening_cash to shifts table
      const { error: shiftError } = await supabase
        .from('shifts')
        .update({ opening_cash: cash })
        .eq('id', newShiftId);
      if (shiftError) throw shiftError;

      // 3. Sync to daily_balances
      const today = new Date().toISOString().split('T')[0];

      // CRITICAL: Only add opening_cash to daily_balances if this is the FIRST shift of the day.
      // If a shift was already closed today, the physical cash is ALREADY recorded in
      // daily_balances (reconciled via actualCash at close). Adding again = double-count bug.
      const { data: closedShiftsToday } = await supabase
        .from('shifts')
        .select('id', { count: 'exact', head: true })
        .eq('cashier_id', initialData.cashierId)
        .eq('status', 'closed')
        .gte('end_time', `${today}T00:00:00`)
        .lt('end_time', `${today}T23:59:59`);

      const hasClosedShiftToday = (closedShiftsToday ?? 0) > 0;

      if (hasClosedShiftToday) {
        // Resume after previous shift closed: cash already in daily_balances from reconcile.
        // Just ensure daily_balances exists for today (it should, but safe-guard).
        const { data: existingBalance } = await supabase
          .from('daily_balances')
          .select('id')
          .eq('date', today)
          .single();

        if (!existingBalance) {
          // Edge case: no daily_balances yet — create with this as opening
          const { error: insertError } = await supabase
            .from('daily_balances')
            .insert({
              date: today,
              cash_balance: cash,
              bank_balance: 0,
              opening_cash: cash,
            });
          if (insertError) throw insertError;
        }
        // opening_cash shift is already saved in step 2 above (for shift report purposes).
      } else {
        // First shift of the day: ensure daily_balances exists and add opening cash
        const { data: existingBalance } = await supabase
          .from('daily_balances')
          .select('id, cash_balance')
          .eq('date', today)
          .single();

        if (existingBalance) {
          const { error: updateError } = await supabase
            .from('daily_balances')
            .update({
              cash_balance: (existingBalance.cash_balance || 0) + cash,
              opening_cash: cash,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBalance.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('daily_balances')
            .insert({
              date: today,
              cash_balance: cash,
              bank_balance: 0,
              opening_cash: cash,
            });
          if (insertError) throw insertError;
        }
      }

      toast.success('Shift berhasil dibuka!');
      // Use hard redirect to force server component re-execute
      window.location.href = '/pos';
    } catch (e: any) {
      console.error('Failed to open shift:', e);
      toast.error('Gagal membuka shift: ' + (e.message || 'Unknown error'));
      setIsNavigating(false);
    } finally {
      setIsOpeningSubmitting(false);
    }
  };

  const handleFinishShift = async () => {
    if (!openShiftId) {
      toast.error('Shift tidak ditemukan. Silakan hubungi owner.');
      return;
    }

    setIsSubmitting(true);

    try {
      const closingCash = initialData.openingCash || 0;
      const expectedCashTotal = closingCash + expectedCash;
      const totalProfit = actualCashNum - closingCash;
      const varianceWithOpening = actualCashNum - expectedCashTotal;
      const now = new Date().toISOString();

      // UPDATE the existing open shift row
      const { error: shiftError } = await supabase
        .from('shifts')
        .update({
          status: 'closed',
          expected_cash: expectedCashTotal,
          actual_cash: actualCashNum,
          variance: varianceWithOpening,
          total_profit: totalProfit,
          end_time: now,
        })
        .eq('id', openShiftId)
        .eq('status', 'open'); // safety: only update if still open

      if (shiftError) throw shiftError;

      // CRITICAL FIX: Reconcile daily_balances with actual cash count
      // The daily_balances.cash_balance accumulates cash sales (+expectedCash) but the
      // physical cash in drawer is actualCashNum. We need to adjust the running balance:
      //   - Remove the expected cash sales from daily_balances (they were added by transactions)
      //   - Add the actual physical cash counted (which includes opening cash + cash sales - any discrepancies)
      // After this, daily_balances.cash_balance reflects the TRUE physical cash position.
      const today = now.split('T')[0];
      const { data: todayBalance } = await supabase
        .from('daily_balances')
        .select('id, cash_balance')
        .eq('date', today)
        .single();

      if (todayBalance) {
        // Recalculate: the balance currently has opening_cash + expectedCash (accumulated from transactions)
        // We want it to have: actualCashNum (physical money counted)
        // Adjustment = actualCashNum - (current running balance)
        const adjustment = actualCashNum - (todayBalance.cash_balance || 0);
        const { error: balanceError } = await supabase
          .from('daily_balances')
          .update({
            cash_balance: actualCashNum,
            updated_at: now,
          })
          .eq('date', today);
        if (balanceError) {
          console.error('Failed to update daily_balances:', balanceError);
          // Non-fatal: shift is already closed, log but don't throw
        }
      }

      setIsSuccess(true);
      localStorage.removeItem('shift_start_time');
      setTimeout(() => {
        handleLogout();
      }, 3000);
    } catch (e: any) {
      console.error('Failed to close shift:', e);
      toast.error('Gagal menyimpan laporan shift: ' + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show "Buka Shift Baru" screen when user has no open shift — FULLY NON-DISMISSIBLE
  if (isOpening) {
    return (
      <div
        className="fixed inset-0 z-[60] min-h-screen bg-gradient-to-br from-slate-900/90 to-slate-800/90 flex flex-col items-center justify-center p-4"
        onContextMenu={(e) => e.preventDefault()}
      >
        <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm">
          {/* Header */}
          <div className="p-6 pb-4 text-center border-b border-slate-100">
            <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-3">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Buka Shift Baru</h2>
            <p className="text-slate-500 text-sm mt-1">
              Masukkan nominal uang laci kasir untuk memulai shift.
            </p>
          </div>

          {/* Input nominal laci */}
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="opening-cash">
                Nominal Tunai di Laci *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">Rp</span>
                <input
                  id="opening-cash"
                  type="number"
                  value={openingCash}
                  onChange={(e) => {
                    setOpeningCash(e.target.value);
                    setOpeningCashError('');
                  }}
                  placeholder="0"
                  className={`w-full pl-12 pr-4 py-3 text-lg font-bold border-2 rounded-xl outline-none transition ${
                    openingCashError
                      ? 'border-red-400 focus:border-red-500'
                      : 'border-slate-200 focus:border-teal-500'
                  }`}
                />
              </div>
              {openingCashError && (
                <p className="text-red-500 text-xs mt-1">{openingCashError}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                Total uang cash yang ada di laci kasir saat ini.
              </p>
            </div>

            <button
              onClick={handleOpenShift}
              disabled={isOpeningSubmitting || isNavigating || openingCash === ''}
              className="w-full py-3 bg-teal-600 text-white font-bold rounded-xl hover:bg-teal-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isOpeningSubmitting && <Loader2 className="w-5 h-5 animate-spin" />}
              Buka Shift &amp; Mulai Berjualan
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Shift Berhasil Ditutup</h2>
          <p className="text-slate-500 mb-6">Laporan shift telah tersimpan. Sistem akan otomatis keluar dalam beberapa detik...</p>
          <button 
            onClick={handleLogout}
            className="w-full py-2.5 bg-slate-100 text-slate-700 font-medium rounded-xl hover:bg-slate-200 transition"
          >
            Keluar Sekarang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link 
            href="/pos"
            className="flex items-center gap-2 text-slate-500 hover:text-slate-800 transition font-medium"
          >
            <ArrowLeft className="w-5 h-5" />
            Kembali ke Kasir
          </Link>
          <div className="text-right">
            <h1 className="text-2xl font-bold text-slate-800">Tutup Shift Kasir</h1>
            <p className="text-sm text-slate-500">
              {new Date(initialData.date).toLocaleDateString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header Info */}
          <div className="bg-slate-800 p-6 text-white flex justify-between items-center">
            <div>
              <p className="text-slate-300 text-sm">Nama Kasir</p>
              <p className="text-lg font-semibold">{initialData.cashierName}</p>
            </div>
            <div className="text-right">
              <p className="text-slate-300 text-sm">Total Transaksi</p>
              <p className="text-lg font-semibold">{initialData.transactionCount} struk</p>
            </div>
          </div>

          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">
              Ringkasan Penjualan
            </h3>
            
            <div className="space-y-4 mb-8">
              <div className="flex justify-between items-center bg-slate-50 p-3 rounded-lg border border-slate-100">
                <span className="text-slate-600 font-medium">Total Penjualan Keseluruhan</span>
                <span className="font-bold text-slate-800 text-lg">{formatCurrency(initialData.totalSales)}</span>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  <span className="text-blue-600 text-sm font-medium block mb-1">Pembayaran Non-Tunai</span>
                  <span className="font-bold text-slate-800">{formatCurrency(initialData.nonCashSales)}</span>
                  <p className="text-xs text-slate-500 mt-1">QRIS & Transfer</p>
                </div>
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                  <span className="text-emerald-700 text-sm font-medium block mb-1">Total Tunai di Laci</span>
                  <span className="font-bold text-slate-800">{formatCurrency(expectedCashWithOpening)}</span>
                  <p className="text-xs text-slate-500 mt-1">Buka ({formatCurrency(shiftOpeningCash)}) + Tunai ({formatCurrency(expectedCash)})</p>
                </div>
              </div>
            </div>

            <h3 className="text-lg font-semibold text-slate-800 mb-4 border-b border-slate-100 pb-2">
              Perhitungan Laci Kasir
            </h3>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Total Uang Tunai Fisik Aktual (Yang Ada di Laci) *
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-medium">Rp</span>
                  <input
                    type="number"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="0"
                    className="w-full pl-12 pr-4 py-3 text-lg font-bold text-slate-800 border-2 border-slate-200 rounded-xl focus:border-teal-500 focus:ring-0 outline-none transition"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Hitung dan masukkan total uang kertas dan koin yang ada di laci kasir saat ini.
                </p>
              </div>

              {actualCash !== '' && (
                <div className={`p-4 rounded-xl flex items-center justify-between border ${
                  variance === 0 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                    : variance > 0
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div>
                    <p className="text-sm font-medium mb-1">Status Selisih (Variance)</p>
                    <p className="font-bold text-lg">
                      {variance === 0 ? 'Klop (Sesuai)' : formatCurrency(Math.abs(variance))}
                    </p>
                  </div>
                  <div className="text-right">
                    {variance > 0 && <span className="text-sm font-medium">+ Kelebihan Uang</span>}
                    {variance < 0 && <span className="text-sm font-medium">- Kekurangan Uang</span>}
                    {variance === 0 && <CheckCircle2 className="w-6 h-6" />}
                  </div>
                </div>
              )}
            </div>

          </div>
          
          <div className="bg-slate-50 p-6 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => window.print()}
              type="button"
              className="px-6 py-3 border-2 border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-100 transition flex items-center justify-center gap-2"
            >
              <Printer className="w-5 h-5" />
              Cetak Laporan
            </button>
            <button
              onClick={handleFinishShift}
              disabled={isSubmitting || actualCash === ''}
              className="flex-1 px-6 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <LogOut className="w-5 h-5" />
              )}
              Selesaikan Shift & Keluar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
