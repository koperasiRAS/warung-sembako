'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Clock, CheckCircle2, AlertTriangle, FileText } from 'lucide-react';

interface Shift {
  id: string;
  cashier_id: string;
  cashierName: string;
  start_time: string;
  end_time: string;
  expected_cash: number;
  actual_cash: number;
  variance: number;
  opening_cash: number;
  total_profit: number;
  cash_balance: number;
  bank_balance: number;
  status: string;
  created_at: string;
}

export default function ShiftsClient({ initialShifts }: { initialShifts: Shift[] }) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const router = useRouter();

  // Sync props → state so realtime router.refresh() updates the display
  useEffect(() => {
    setShifts(initialShifts);
  }, [initialShifts]);

  // Realtime: refresh when shifts table changes (new shift closed, etc.)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('shifts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shifts' },
        () => { router.refresh(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Laporan Shift Kasir</h1>
          <p className="text-sm text-slate-500 mt-1">
            Pantau riwayat tutup kasir, saldo laci, dan selisih (variance) setiap shift.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Kasir</th>
                <th className="px-6 py-4 font-medium">Waktu Tutup Shift</th>
                <th className="px-6 py-4 font-medium text-right">Saldo Tunai</th>
                <th className="px-6 py-4 font-medium text-right">Saldo Bank</th>
                <th className="px-6 py-4 font-medium text-right">Profit</th>
                <th className="px-6 py-4 font-medium text-right">Selisih (Variance)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium text-slate-600">Belum ada data shift</p>
                    <p className="text-sm mt-1">Laporan akan muncul setelah kasir melakukan "Tutup Kasir".</p>
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => (
                  <tr key={shift.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-800">{shift.cashierName}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{shift.status}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400" />
                        {formatDateTime(shift.end_time || shift.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">
                      {formatCurrency(shift.cash_balance || 0)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-slate-700">
                      {formatCurrency(shift.bank_balance || 0)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`font-bold ${
                        (shift.total_profit || 0) >= 0 ? 'text-emerald-600' : 'text-red-600'
                      }`}>
                        {(shift.total_profit || 0) >= 0 ? '+' : ''}{formatCurrency(shift.total_profit || 0)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`inline-flex items-center justify-end gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium w-full
                        ${shift.variance === 0 
                          ? 'bg-emerald-50 text-emerald-700' 
                          : shift.variance > 0 
                            ? 'bg-amber-50 text-amber-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}
                      >
                        {shift.variance === 0 ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Klop
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {shift.variance > 0 ? '+' : ''}{formatCurrency(shift.variance)}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
