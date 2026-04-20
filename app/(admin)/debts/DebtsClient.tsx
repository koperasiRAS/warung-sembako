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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} className="sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)',
            fontWeight: '700', color: 'var(--color-on-surface)', letterSpacing: 'var(--tracking-tight)',
          }}>
            Buku Utang / Kasbon
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
            color: 'var(--color-outline)', marginTop: 'var(--space-1)',
          }}>
            Kelola piutang pelanggan dan catat pelunasan
          </p>
        </div>
        <div style={{
          padding: 'var(--space-3) var(--space-4)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--color-warning-bg)',
          backgroundColor: 'var(--color-warning-bg)',
          display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
        }}>
          <div>
            <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', fontWeight: '500', color: 'var(--color-warning)' }}>Total Uang di Luar (Piutang)</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-warning)' }}>{formatCurrency(totalUnpaid)}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} className="sm:flex-row sm:items-center sm:justify-between">
        <div style={{ position: 'relative', width: '100%', maxWidth: '28rem' }}>
          <Search style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--color-outline)' }} />
          <input
            type="text"
            placeholder="Cari nama pelanggan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '2.25rem',
              paddingRight: 'var(--space-4)',
              paddingTop: 'var(--space-2)',
              paddingBottom: 'var(--space-2)',
              border: '1.5px solid var(--color-outline-variant)',
              borderRadius: 'var(--radius-lg)',
              outline: 'none',
              backgroundColor: 'var(--color-surface-container-high)',
              color: 'var(--color-on-surface)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body-sm)',
              transition: 'border-color var(--transition-fast)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
          />
        </div>
      </div>

      {/* Table */}
      <div style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', fontSize: 'var(--text-body-sm)' }}>
            <thead style={{
              fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)',
              fontWeight: '600', textTransform: 'uppercase',
              color: 'var(--color-on-surface-variant)',
              backgroundColor: 'var(--color-surface-container)',
              borderBottom: '1px solid var(--color-outline-variant)',
            }}>
              <tr>
                {['Pelanggan', 'Tanggal Kasbon', 'Total Utang', 'Sisa Terutang', 'Status', 'Aksi'].map((h) => (
                  <th key={h} style={{
                    padding: 'var(--space-4)',
                    textAlign: h.includes('Utang') || h === 'Aksi' ? 'right' : (h === 'Status' ? 'center' : 'left'),
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredDebts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <BookUser style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-3)' }} />
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-on-surface-variant)' }}>Buku Utang Bersih!</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-1)' }}>Tidak ada catatan kasbon saat ini.</p>
                  </td>
                </tr>
              ) : (
                filteredDebts.map((debt) => {
                  const statusStyle = debt.status === 'paid'
                    ? { bg: 'var(--color-tertiary-fixed)', color: 'var(--color-tertiary)' }
                    : debt.status === 'partial'
                    ? { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' }
                    : { bg: 'var(--color-error-container)', color: 'var(--color-error)' };
                  return (
                    <tr key={debt.id} style={{ borderBottom: '1px solid var(--color-outline-variant)', transition: 'background-color var(--transition-fast)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: 'var(--space-4)', fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                        {debt.customer_name}
                      </td>
                      <td style={{ padding: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                        {formatDate(debt.created_at)}
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                        {formatCurrency(debt.amount)}
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: 'var(--text-body-sm)', color: 'var(--color-warning)' }}>
                        {formatCurrency(debt.remaining_amount)}
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'center' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)',
                          fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', fontWeight: '600',
                          backgroundColor: statusStyle.bg, color: statusStyle.color,
                        }}>
                          {debt.status === 'paid' ? 'Lunas' : debt.status === 'partial' ? 'Dicicil' : 'Belum Bayar'}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                        {debt.status !== 'paid' ? (
                          <button
                            onClick={() => handleOpenPayment(debt)}
                            style={{
                              padding: 'var(--space-1) var(--space-3)',
                              backgroundColor: 'var(--color-primary-fixed)',
                              color: 'var(--color-primary)',
                              border: 'none', borderRadius: 'var(--radius-lg)',
                              fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)',
                              fontWeight: '600',
                              cursor: 'pointer',
                              transition: 'all var(--transition-fast)',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; e.currentTarget.style.color = 'var(--color-on-primary)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary-fixed)'; e.currentTarget.style.color = 'var(--color-primary)'; }}
                          >
                            Proses Bayar
                          </button>
                        ) : (
                          <CheckCircle2 style={{ width: '1.25rem', height: '1.25rem', color: 'var(--color-tertiary)', marginLeft: 'auto' }} />
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Processing Modal */}
      {isPaying && selectedDebt && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(30,27,75,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '28rem',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-overlay)',
            animation: 'fadeIn 200ms ease',
          }}>
            <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-on-surface)' }}>Proses Pembayaran Kasbon</h2>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-1)' }}>Pembayaran dari: <strong style={{ color: 'var(--color-on-surface)' }}>{selectedDebt.customer_name}</strong></p>
            </div>

            <form onSubmit={handleSubmitPayment} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div style={{
                padding: 'var(--space-4)',
                borderRadius: 'var(--radius-xl)',
                backgroundColor: 'var(--color-warning-bg)',
                border: '1px solid var(--color-warning)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-warning)' }}>Sisa Utang:</span>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-warning)' }}>{formatCurrency(selectedDebt.remaining_amount)}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Jumlah Uang Diterima (Rp)
                  </label>
                  <input
                    type="number"
                    max={selectedDebt.remaining_amount}
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-xl)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
                      transition: 'border-color var(--transition-fast)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    placeholder="Contoh: 50000"
                  />
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(selectedDebt.remaining_amount.toString())}
                      style={{
                        padding: '2px var(--space-3)',
                        backgroundColor: 'var(--color-warning-bg)',
                        color: 'var(--color-warning)',
                        border: 'none', borderRadius: 'var(--radius-full)',
                        fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', fontWeight: '600',
                        cursor: 'pointer',
                        transition: 'background-color var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-warning)'; e.currentTarget.style.color = '#fff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-warning-bg)'; e.currentTarget.style.color = 'var(--color-warning)'; }}
                    >
                      Lunasi Semua
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Pilih Metode Pembayaran
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-xl)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-body)',
                      cursor: 'pointer',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  >
                    <option value="cash">Tunai (Cash)</option>
                    <option value="transfer">Transfer Bank</option>
                    <option value="qris">QRIS</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-4)', flexDirection: 'row-reverse' }}>
                <button
                  type="submit"
                  disabled={isSubmitting || !paymentAmount}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: (isSubmitting || !paymentAmount) ? 'var(--color-surface-container)' : 'var(--color-primary)',
                    color: (isSubmitting || !paymentAmount) ? 'var(--color-outline)' : 'var(--color-on-primary)',
                    border: 'none', borderRadius: 'var(--radius-xl)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: (isSubmitting || !paymentAmount) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />
                      Memproses...
                    </>
                  ) : 'Terima Pembayaran'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsPaying(false)}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3) var(--space-4)',
                    border: '1px solid var(--color-outline-variant)',
                    color: 'var(--color-on-surface-variant)',
                    borderRadius: 'var(--radius-xl)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    cursor: 'pointer', backgroundColor: 'transparent',
                  }}
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        </div>
      )}
    </div>
  );
}
