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
    router.push('/pin');
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
      const { count: closedShiftCount } = await supabase
        .from('shifts')
        .select('*', { count: 'exact', head: true })
        .eq('cashier_id', initialData.cashierId)
        .eq('status', 'closed')
        .gte('end_time', `${today}T00:00:00`)
        .lt('end_time', `${today}T23:59:59`);

      const hasClosedShiftToday = (closedShiftCount ?? 0) > 0;

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
        style={{
          position: 'fixed', inset: '0', zIndex: 'var(--z-modal)',
          background: 'linear-gradient(135deg, rgb(26,25,48) 0%, rgb(71,69,83) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 'var(--space-4)',
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        <div style={{
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-overlay)',
          border: '1px solid var(--color-outline-variant)',
          width: '100%', maxWidth: '28rem', overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: 'var(--space-6)', borderBottom: '1px solid var(--color-outline-variant)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '4rem', height: '4rem',
              backgroundColor: 'var(--color-warning-bg)',
              color: 'var(--color-warning)',
              borderRadius: 'var(--radius-full)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-3)',
            }}>
              <Clock style={{ width: '2rem', height: '2rem' }} />
            </div>
            <h2 style={{
              fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
              fontWeight: '700', color: 'var(--color-on-surface)',
            }}>
              Buka Shift Baru
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
              color: 'var(--color-outline)', marginTop: 'var(--space-1)',
            }}>
              Masukkan nominal uang laci kasir untuk memulai shift.
            </p>
          </div>

          {/* Input nominal laci */}
          <div style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{
                display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
                fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)',
              }} htmlFor="opening-cash">
                Nominal Tunai di Laci *
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 'var(--space-4)',
                  top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--color-outline)', fontFamily: 'var(--font-body)', fontWeight: '500',
                }}>Rp</span>
                <input
                  id="opening-cash"
                  type="number"
                  value={openingCash}
                  onChange={(e) => {
                    setOpeningCash(e.target.value);
                    setOpeningCashError('');
                  }}
                  placeholder="0"
                  style={{
                    width: '100%',
                    padding: 'var(--space-3) var(--space-4) var(--space-3) 3rem',
                    fontSize: 'var(--text-title-lg)', fontWeight: '700',
                    border: `1.5px solid ${openingCashError ? 'var(--color-error)' : 'var(--color-outline-variant)'}`,
                    borderRadius: 'var(--radius-lg)', outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                    transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = openingCashError ? 'var(--color-error)' : 'var(--color-primary)';
                    e.target.style.backgroundColor = 'var(--color-surface-container-lowest)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = openingCashError ? 'var(--color-error)' : 'var(--color-outline-variant)';
                    e.target.style.backgroundColor = 'var(--color-surface-container-high)';
                  }}
                />
              </div>
              {openingCashError && (
                <p style={{
                  color: 'var(--color-error)', fontSize: 'var(--text-label-sm)', marginTop: 'var(--space-1)',
                  fontFamily: 'var(--font-body)',
                }}>{openingCashError}</p>
              )}
              <p style={{
                color: 'var(--color-outline)', fontSize: 'var(--text-label-xs)', marginTop: 'var(--space-1)',
                fontFamily: 'var(--font-body)',
              }}>
                Total uang cash yang ada di laci kasir saat ini.
              </p>
            </div>

            <button
              onClick={handleOpenShift}
              disabled={isOpeningSubmitting || isNavigating || openingCash === ''}
              style={{
                width: '100%', padding: 'var(--space-3)',
                background: (isOpeningSubmitting || isNavigating || openingCash === '') ? 'var(--color-surface-container)' : 'var(--gradient-primary)',
                color: (isOpeningSubmitting || isNavigating || openingCash === '') ? 'var(--color-outline)' : 'var(--color-on-primary)',
                border: 'none', borderRadius: 'var(--radius-lg)',
                fontFamily: 'var(--font-label)', fontWeight: '600',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                cursor: (isOpeningSubmitting || isNavigating || openingCash === '') ? 'not-allowed' : 'pointer',
                transition: 'opacity var(--transition-fast)',
              }}
              onMouseEnter={(e) => { if (!(isOpeningSubmitting || isNavigating)) e.currentTarget.style.opacity = '0.85'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              {isOpeningSubmitting && <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 0.6s linear infinite' }} />}
              Buka Shift &amp; Mulai Berjualan
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div style={{
        minHeight: '100vh', backgroundColor: 'var(--color-surface)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--space-4)',
      }}>
        <div style={{
          backgroundColor: 'var(--color-surface-container-lowest)',
          padding: 'var(--space-8)', borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-sm)', border: '1px solid var(--color-outline-variant)',
          textAlign: 'center', width: '100%', maxWidth: '28rem',
        }}>
          <div style={{
            width: '4rem', height: '4rem',
            backgroundColor: 'var(--color-success-container)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-full)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto var(--space-4)',
          }}>
            <CheckCircle2 style={{ width: '2rem', height: '2rem' }} />
          </div>
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
            fontWeight: '700', color: 'var(--color-on-surface)', marginBottom: 'var(--space-2)',
          }}>
            Shift Berhasil Ditutup
          </h2>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
            color: 'var(--color-outline)', marginBottom: 'var(--space-6)',
          }}>
            Laporan shift telah tersimpan. Sistem akan otomatis keluar dalam beberapa detik...
          </p>
          <button
            onClick={handleLogout}
            style={{
              width: '100%', padding: 'var(--space-3) var(--space-4)',
              backgroundColor: 'var(--color-surface-container-high)',
              color: 'var(--color-on-surface-variant)',
              border: 'none', borderRadius: 'var(--radius-lg)',
              fontFamily: 'var(--font-label)', fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
          >
            Keluar Sekarang
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: 'var(--color-surface)',
      padding: 'var(--space-8) var(--space-4)',
    }}>
      <div style={{ maxWidth: '42rem', margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 'var(--space-6)',
        }}>
          <Link
            href="/pos"
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              color: 'var(--color-outline)', fontFamily: 'var(--font-label)', fontWeight: '500',
              textDecoration: 'none',
              transition: 'color var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-on-surface)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-outline)'; }}
          >
            <ArrowLeft style={{ width: '1.25rem', height: '1.25rem' }} />
            Kembali ke Kasir
          </Link>
          <div style={{ textAlign: 'right' }}>
            <h1 style={{
              fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)',
              fontWeight: '700', color: 'var(--color-on-surface)',
            }}>
              Tutup Shift Kasir
            </h1>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
              color: 'var(--color-outline)', marginTop: 'var(--space-1)',
            }}>
              {new Date(initialData.date).toLocaleDateString('id-ID', {
                weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
              })}
            </p>
          </div>
        </div>

        <div style={{
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-sm)',
          border: '1px solid var(--color-outline-variant)',
          overflow: 'hidden',
        }}>
          {/* Header Info */}
          <div style={{
            backgroundColor: 'var(--color-primary)',
            padding: 'var(--space-6)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)',
                color: 'var(--color-primary-fixed-dim)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)',
              }}>
                Nama Kasir
              </p>
              <p style={{
                fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
                fontWeight: '600', color: 'var(--color-on-primary)', marginTop: '2px',
              }}>
                {initialData.cashierName}
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)',
                color: 'var(--color-primary-fixed-dim)', textTransform: 'uppercase', letterSpacing: 'var(--tracking-wider)',
              }}>
                Total Transaksi
              </p>
              <p style={{
                fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
                fontWeight: '600', color: 'var(--color-on-primary)', marginTop: '2px',
              }}>
                {initialData.transactionCount} struk
              </p>
            </div>
          </div>

          <div style={{ padding: 'var(--space-6)' }}>
            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
              fontWeight: '600', color: 'var(--color-on-surface)',
              paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--color-outline-variant)',
            }}>
              Ringkasan Penjualan
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-8)' }}>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                backgroundColor: 'var(--color-surface-container)', padding: 'var(--space-3)',
                borderRadius: 'var(--radius-md)', border: '1px solid var(--color-outline-variant)',
              }}>
                <span style={{
                  fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
                  color: 'var(--color-on-surface-variant)', fontWeight: '500',
                }}>
                  Total Penjualan Keseluruhan
                </span>
                <span style={{
                  fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
                  fontWeight: '700', color: 'var(--color-on-surface)',
                }}>
                  {formatCurrency(initialData.totalSales)}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div style={{
                  backgroundColor: 'rgba(59,130,246,0.08)',
                  padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(59,130,246,0.15)',
                }}>
                  <span style={{
                    display: 'block', fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)',
                    fontWeight: '600', color: 'rgb(37,99,235)', marginBottom: 'var(--space-1)',
                  }}>
                    Pembayaran Non-Tunai
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-md)',
                    fontWeight: '700', color: 'var(--color-on-surface)',
                  }}>
                    {formatCurrency(initialData.nonCashSales)}
                  </span>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 'var(--text-label-xs)',
                    color: 'var(--color-outline)', marginTop: 'var(--space-1)',
                  }}>
                    QRIS & Transfer
                  </p>
                </div>
                <div style={{
                  backgroundColor: 'rgba(16,185,129,0.08)',
                  padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
                  border: '1px solid rgba(16,185,129,0.15)',
                }}>
                  <span style={{
                    display: 'block', fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)',
                    fontWeight: '600', color: 'rgb(5,150,105)', marginBottom: 'var(--space-1)',
                  }}>
                    Total Tunai di Laci
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-md)',
                    fontWeight: '700', color: 'var(--color-on-surface)',
                  }}>
                    {formatCurrency(expectedCashWithOpening)}
                  </span>
                  <p style={{
                    fontFamily: 'var(--font-body)', fontSize: 'var(--text-label-xs)',
                    color: 'var(--color-outline)', marginTop: 'var(--space-1)',
                  }}>
                    Buka ({formatCurrency(shiftOpeningCash)}) + Tunai ({formatCurrency(expectedCash)})
                  </p>
                </div>
              </div>
            </div>

            <h3 style={{
              fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
              fontWeight: '600', color: 'var(--color-on-surface)',
              paddingBottom: 'var(--space-4)', marginBottom: 'var(--space-4)',
              borderBottom: '1px solid var(--color-outline-variant)',
            }}>
              Perhitungan Laci Kasir
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
              <div>
                <label style={{
                  display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
                  fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)',
                }}>
                  Total Uang Tunai Fisik Aktual (Yang Ada di Laci) *
                </label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 'var(--space-4)',
                    top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--color-outline)', fontFamily: 'var(--font-body)', fontWeight: '500',
                  }}>Rp</span>
                  <input
                    type="number"
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="0"
                    style={{
                      width: '100%',
                      padding: 'var(--space-3) var(--space-4) var(--space-3) 3rem',
                      fontSize: 'var(--text-title-lg)', fontWeight: '700',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)', outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)', fontFamily: 'var(--font-heading)',
                      transition: 'border-color var(--transition-fast), background-color var(--transition-fast)',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = 'var(--color-primary)';
                      e.target.style.backgroundColor = 'var(--color-surface-container-lowest)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = 'var(--color-outline-variant)';
                      e.target.style.backgroundColor = 'var(--color-surface-container-high)';
                    }}
                  />
                </div>
                <p style={{
                  color: 'var(--color-outline)', fontSize: 'var(--text-label-xs)', marginTop: 'var(--space-2)',
                  fontFamily: 'var(--font-body)',
                }}>
                  Hitung dan masukkan total uang kertas dan koin yang ada di laci kasir saat ini.
                </p>
              </div>

              {actualCash !== '' && (
                <div style={{
                  padding: 'var(--space-4)', borderRadius: 'var(--radius-lg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  border: `1.5px solid ${
                    variance === 0 ? 'rgba(16,185,129,0.3)' :
                    variance > 0 ? 'rgba(245,158,11,0.3)' : 'var(--color-error-container)'
                  }`,
                  backgroundColor: (
                    variance === 0 ? 'rgba(16,185,129,0.06)' :
                    variance > 0 ? 'var(--color-warning-bg)' : 'var(--color-error-container)'
                  ),
                  color: (
                    variance === 0 ? 'var(--color-success)' :
                    variance > 0 ? 'rgb(120,53,15)' : 'var(--color-error)'
                  ),
                }}>
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
                      fontWeight: '600', marginBottom: 'var(--space-1)',
                    }}>
                      Status Selisih (Variance)
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)',
                      fontWeight: '700',
                    }}>
                      {variance === 0 ? 'Klop (Sesuai)' : formatCurrency(Math.abs(variance))}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {variance > 0 && (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '600' }}>
                        + Kelebihan Uang
                      </span>
                    )}
                    {variance < 0 && (
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '600' }}>
                        - Kekurangan Uang
                      </span>
                    )}
                    {variance === 0 && <CheckCircle2 style={{ width: '1.5rem', height: '1.5rem' }} />}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div style={{
            backgroundColor: 'var(--color-surface-container)',
            padding: 'var(--space-6)', borderTop: '1px solid var(--color-outline-variant)',
            display: 'flex', flexDirection: 'column', gap: 'var(--space-3)',
          }}>
            <div style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: 'row' }}>
              <button
                onClick={() => window.print()}
                type="button"
                style={{
                  padding: 'var(--space-3) var(--space-6)',
                  border: '1.5px solid var(--color-outline-variant)',
                  color: 'var(--color-on-surface-variant)',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                  cursor: 'pointer', backgroundColor: 'transparent',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Printer style={{ width: '1.25rem', height: '1.25rem' }} />
                Cetak Laporan
              </button>
              <button
                onClick={handleFinishShift}
                disabled={isSubmitting || actualCash === ''}
                style={{
                  flex: 1,
                  padding: 'var(--space-3) var(--space-6)',
                  backgroundColor: (isSubmitting || actualCash === '') ? 'var(--color-surface-container)' : 'var(--color-error)',
                  color: (isSubmitting || actualCash === '') ? 'var(--color-outline)' : 'var(--color-on-error)',
                  border: 'none', borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                  cursor: (isSubmitting || actualCash === '') ? 'not-allowed' : 'pointer',
                  transition: 'background-color var(--transition-fast)',
                }}
                onMouseEnter={(e) => { if (!(isSubmitting || actualCash === '')) e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                {isSubmitting ? (
                  <Loader2 style={{ width: '1.25rem', height: '1.25rem', animation: 'spin 0.6s linear infinite' }} />
                ) : (
                  <LogOut style={{ width: '1.25rem', height: '1.25rem' }} />
                )}
                Selesaikan Shift & Keluar
              </button>
            </div>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
