'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { LogOut, Calculator, ArrowLeft, Loader2, Printer, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface ShiftData {
  cashierName: string;
  cashierId: string;
  date: string;
  totalSales: number;
  cashSales: number;
  nonCashSales: number;
  transactionCount: number;
}

export default function ShiftClient({ initialData }: { initialData: ShiftData }) {
  const router = useRouter();
  const supabase = createClient();
  const [actualCash, setActualCash] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

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
  const variance = actualCashNum - expectedCash;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  const handleFinishShift = async () => {
    setIsSubmitting(true);
    
    try {
      const { error } = await supabase.from('shifts').insert({
        cashier_id: initialData.cashierId,
        expected_cash: expectedCash,
        actual_cash: actualCashNum,
        variance: variance,
        status: 'closed',
        start_time: localStorage.getItem('shift_start_time') || (() => {
          const t = new Date(initialData.date);
          t.setHours(0, 0, 0, 0);
          return t.toISOString();
        })(),
        end_time: new Date().toISOString()
      });

      if (error) throw error;
      
      setIsSuccess(true);
      // Clear shift start time and auto logout after 3 seconds
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
                  <span className="text-emerald-700 text-sm font-medium block mb-1">Pembayaran Tunai</span>
                  <span className="font-bold text-slate-800">{formatCurrency(initialData.cashSales)}</span>
                  <p className="text-xs text-slate-500 mt-1">Estimasi Uang di Laci</p>
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
