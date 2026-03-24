'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookUser, Search, CheckCircle2, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useDebounce } from '@/hooks/useDebounce';
import toast from 'react-hot-toast';

interface Debt {
  id: string;
  transaction_id: string;
  customer_name: string;
  amount: number;
  remaining_amount: number;
  status: 'unpaid' | 'partial' | 'paid';
  due_date: string | null;
  created_at: string;
}

export default function DebtsClient({ initialDebts, userRole }: { initialDebts: Debt[], userRole: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  
  const [isPaying, setIsPaying] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash'|'bank'|'qris'|'transfer'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const filteredDebts = debts.filter(debt => 
    (debt.customer_name || '').toLowerCase().includes(debouncedSearch.toLowerCase())
  );

  const totalUnpaid = debts.reduce((sum, debt) => sum + debt.remaining_amount, 0);

  const handleOpenPayment = (debt: Debt) => {
    setSelectedDebt(debt);
    setPaymentAmount(debt.remaining_amount.toString());
    setIsPaying(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;

    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0 || amount > selectedDebt.remaining_amount) {
      toast.error('Jumlah pembayaran tidak valid!');
      return;
    }

    setIsSubmitting(true);

    try {
      // 1. Process payment via securely defined RPC to update balance automatically
      const { error: paymentError } = await supabase.rpc('pay_debt', {
        p_debt_id: selectedDebt.id,
        p_amount: amount,
        p_payment_method: paymentMethod,
        p_note: `Pembayaran kasbon via ${userRole}`
      });

      // Temporary fallback in case the user hasn't executed the SQL migration yet
      if (paymentError) {
        console.warn('RPC pay_debt failed (might need migration). Trying manual fallback...', paymentError);

        // Insert payment record with error handling
        const { error: insertError } = await supabase.from('debt_payments').insert({
          debt_id: selectedDebt.id,
          amount: amount,
          note: `Pembayaran kasbon via ${userRole}`
        });

        if (insertError) {
          console.error('Failed to insert debt payment:', insertError);
          throw new Error('Gagal mencatat pembayaran: ' + insertError.message);
        }

        const { error: updateError } = await supabase
          .from('debts')
          .update({
            remaining_amount: selectedDebt.remaining_amount - amount,
            status: selectedDebt.remaining_amount - amount <= 0 ? 'paid' : 'partial',
            updated_at: new Date().toISOString()
          })
          .eq('id', selectedDebt.id);

        if (updateError) throw updateError;
      }

      // Calculate new remaining and status for UI
      const newRemaining = selectedDebt.remaining_amount - amount;
      const newStatus = newRemaining <= 0 ? 'paid' : 'partial';

      // Only update UI state AFTER all database operations succeeded
      setDebts(prev => prev.map(d => {
        if (d.id === selectedDebt.id) {
          return { ...d, remaining_amount: newRemaining, status: newStatus };
        }
        return d;
      }));

      setIsPaying(false);
      setSelectedDebt(null);
      setPaymentAmount('');
      router.refresh();
      toast.success('Pembayaran kasbon berhasil!');

    } catch (error: any) {
      console.error('Payment processing failed:', error);
      toast.error('Gagal memproses pembayaran: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Buku Utang / Kasbon</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola piutang pelanggan dan catat pelunasan
          </p>
        </div>
        <div className="bg-orange-50 border border-orange-200 px-4 py-2 rounded-xl flex items-center gap-3">
          <div>
            <p className="text-xs text-orange-600 font-medium">Total Uang di Luar (Piutang)</p>
            <p className="text-lg font-bold text-orange-700">{formatCurrency(totalUnpaid)}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-sm transition"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Pelanggan</th>
                <th className="px-6 py-4 font-medium">Tanggal Kasbon</th>
                <th className="px-6 py-4 font-medium text-right">Total Utang</th>
                <th className="px-6 py-4 font-medium text-right">Sisa Terutang</th>
                <th className="px-6 py-4 font-medium text-center">Status</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    <BookUser className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium text-slate-600">Buku Utang Bersih!</p>
                    <p className="text-sm mt-1">Tidak ada catatan kasbon saat ini.</p>
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt) => (
                  <tr key={debt.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {debt.customer_name}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {formatDate(debt.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {formatCurrency(debt.amount)}
                    </td>
                    <td className="px-6 py-4 text-right font-bold text-orange-600">
                      {formatCurrency(debt.remaining_amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium border
                        ${debt.status === 'paid' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                          : debt.status === 'partial'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {debt.status === 'paid' ? 'Lunas' : debt.status === 'partial' ? 'Dicicil' : 'Belum Bayar'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {debt.status !== 'paid' ? (
                        <button
                          onClick={() => handleOpenPayment(debt)}
                          className="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded-lg transition text-xs font-medium"
                        >
                          Proses Bayar
                        </button>
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {isPaying && selectedDebt && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-bold text-slate-800">Proses Pembayaran Kasbon</h2>
              <p className="text-sm text-slate-500 mt-1">Pembayaran dari: <strong className="text-slate-800">{selectedDebt.customer_name}</strong></p>
            </div>
            
            <form onSubmit={handleSubmitPayment} className="p-6">
              <div className="mb-6 p-4 bg-orange-50 rounded-xl flex justify-between items-center border border-orange-100">
                <span className="text-sm text-orange-800 font-medium">Sisa Utang:</span>
                <span className="text-xl font-bold text-orange-600">{formatCurrency(selectedDebt.remaining_amount)}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Jumlah Uang Diterima (Rp)</label>
                  <input
                    type="number"
                    max={selectedDebt.remaining_amount}
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="w-full px-4 py-3 text-lg border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="Contoh: 50000"
                  />
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" onClick={() => setPaymentAmount(selectedDebt.remaining_amount.toString())} className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full hover:bg-orange-200">Lunasi Semua</button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Pilih Metode Pembayaran</label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-slate-700"
                  >
                    <option value="cash">Tunai (Cash)</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>
              </div>
              <div className="mt-8 flex gap-3 flex-row-reverse">
                <button
                  type="submit"
                  disabled={isSubmitting || !paymentAmount}
                  className="flex-1 bg-primary text-white px-4 py-3 rounded-xl hover:bg-primary-dark transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    'Terima Pembayaran'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaying(false)}
                  disabled={isSubmitting}
                  className="flex-1 border border-slate-300 text-slate-700 px-4 py-3 rounded-xl hover:bg-slate-50 transition font-medium"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
