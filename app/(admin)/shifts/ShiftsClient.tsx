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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }} className="sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)',
            fontWeight: '700', color: 'var(--color-on-surface)', letterSpacing: 'var(--tracking-tight)',
          }}>
            Laporan Shift Kasir
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
            color: 'var(--color-outline)', marginTop: 'var(--space-1)',
          }}>
            Pantau riwayat tutup kasir, saldo laci, dan selisih (variance) setiap shift.
          </p>
        </div>
      </div>

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
                {['Kasir', 'Waktu Tutup Shift', 'Saldo Tunai', 'Saldo Bank', 'Profit', 'Selisih (Variance)'].map((h) => (
                  <th key={h} style={{
                    padding: 'var(--space-4)',
                    textAlign: h.includes('Saldo') || h.includes('Profit') || h.includes('Selisih') ? 'right' : 'left',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shifts.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <FileText style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-3)' }} />
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-on-surface-variant)' }}>Belum ada data shift</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-1)' }}>Laporan akan muncul setelah kasir melakukan "Tutup Kasir".</p>
                  </td>
                </tr>
              ) : (
                shifts.map((shift) => {
                  const profitColor = (shift.total_profit || 0) >= 0 ? 'var(--color-tertiary)' : 'var(--color-error)';
                  const varianceStyle = shift.variance === 0
                    ? { bg: 'var(--color-tertiary-fixed)', color: 'var(--color-tertiary)' }
                    : shift.variance > 0
                    ? { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' }
                    : { bg: 'var(--color-error-container)', color: 'var(--color-error)' };
                  return (
                    <tr key={shift.id} style={{ borderBottom: '1px solid var(--color-outline-variant)', transition: 'background-color var(--transition-fast)' }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <td style={{ padding: 'var(--space-4)' }}>
                        <div style={{ fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-on-surface)' }}>{shift.cashierName}</div>
                        <div style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', color: 'var(--color-outline)', marginTop: '2px' }}>{shift.status}</div>
                      </td>
                      <td style={{ padding: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                          <Clock style={{ width: '1rem', height: '1rem', color: 'var(--color-outline)' }} />
                          {formatDateTime(shift.end_time || shift.created_at)}
                        </div>
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                        {formatCurrency(shift.cash_balance || 0)}
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                        {formatCurrency(shift.bank_balance || 0)}
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: 'var(--text-body-sm)', color: profitColor }}>
                        {(shift.total_profit || 0) >= 0 ? '+' : ''}{formatCurrency(shift.total_profit || 0)}
                      </td>
                      <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end',
                          gap: 'var(--space-1)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)',
                          fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', fontWeight: '600',
                          backgroundColor: varianceStyle.bg, color: varianceStyle.color,
                          width: '100%',
                        }}>
                          {shift.variance === 0 ? (
                            <><CheckCircle2 style={{ width: '0.875rem', height: '0.875rem' }} /> Klop</>
                          ) : (
                            <><AlertTriangle style={{ width: '0.875rem', height: '0.875rem' }} />{shift.variance > 0 ? '+' : ''}{formatCurrency(shift.variance)}</>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
