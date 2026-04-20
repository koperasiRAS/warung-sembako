'use client';

import { useState } from 'react';
import { ShieldAlert, Loader2, Database, Trash2 } from 'lucide-react';

export function ResetDataComponent() {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmation !== 'RESET') {
      setError('Ketik RESET dengan huruf kapital semua');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch('/api/reset-database', {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Gagal mereset database');
      }

      setIsOpen(false);
      setConfirmation('');
      window.location.href = '/dashboard';
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ marginTop: 'var(--space-8)', borderTop: '1px solid var(--color-error-container)', paddingTop: 'var(--space-8)' }}>
      <div style={{
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--space-6)',
        border: '1px solid var(--color-error)',
        backgroundColor: 'var(--color-error-container)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexDirection: 'column', gap: 'var(--space-4)' }} className="sm:flex-row sm:items-center">
          <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center' }}>
            <div style={{
              width: '3rem', height: '3rem', borderRadius: 'var(--radius-full)',
              backgroundColor: 'var(--color-error)', color: 'var(--color-on-error)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: '0',
            }}>
              <Database style={{ width: '1.5rem', height: '1.5rem' }} />
            </div>
            <div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-error)', marginBottom: 'var(--space-1)' }}>Zona Bahaya (Danger Zone)</h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-error)', maxWidth: '32rem' }}>
                Tindakan ini akan menghapus permanen seluruh data toko (struk, barang, kasir, log) dan tidak bisa dikembalikan.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-5)',
              backgroundColor: 'var(--color-error)',
              color: 'var(--color-on-error)',
              border: 'none', borderRadius: 'var(--radius-lg)',
              fontFamily: 'var(--font-label)', fontWeight: '600',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'background-color var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            <Trash2 style={{ width: '1.25rem', height: '1.25rem' }} />
            Reset Sistem
          </button>
        </div>
      </div>

      {isOpen && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(30,27,75,0.6)', backdropFilter: 'blur(4px)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-2xl)',
            width: '100%', maxWidth: '28rem',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-overlay)',
            animation: 'fadeIn 200ms ease',
          }}>
            <div style={{
              padding: 'var(--space-6)', borderBottom: '1px solid var(--color-error-container)',
              backgroundColor: 'var(--color-error-container)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <ShieldAlert style={{ width: '1.5rem', height: '1.5rem', color: 'var(--color-error)' }} />
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-error)' }}>Konfirmasi Reset Sistem</h2>
              </div>
            </div>

            <form onSubmit={handleReset} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-4)', lineHeight: 'var(--leading-relaxed)' }}>
                Anda yakin ingin menghapus <strong style={{ color: 'var(--color-on-surface)' }}>seluruh data operasional</strong> (termasuk pendaftaran karyawan)? Tindakan ini <strong style={{ color: 'var(--color-on-surface)' }}>tidak dapat dibatalkan</strong>!
              </p>

              {error && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-error-container)', color: 'var(--color-error)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '600' }}>
                  {error}
                </div>
              )}

              <div style={{ marginBottom: 'var(--space-6)' }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Ketik <span style={{ color: 'var(--color-error)', fontWeight: '700', userSelect: 'all' }}>RESET</span> untuk melanjutkan
                </label>
                <input
                  type="text"
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-sm)',
                    transition: 'border-color var(--transition-fast)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-error)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  placeholder="RESET"
                  autoComplete="off"
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', flexDirection: 'row-reverse' }}>
                <button
                  type="submit"
                  disabled={isSubmitting || confirmation !== 'RESET'}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3) var(--space-4)',
                    backgroundColor: (isSubmitting || confirmation !== 'RESET') ? 'var(--color-surface-container)' : 'var(--color-error)',
                    color: (isSubmitting || confirmation !== 'RESET') ? 'var(--color-outline)' : 'var(--color-on-error)',
                    border: 'none', borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: (isSubmitting || confirmation !== 'RESET') ? 'not-allowed' : 'pointer',
                    transition: 'background-color var(--transition-fast)',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />
                      Mereset...
                    </>
                  ) : 'Ya, Hapus Semua'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3) var(--space-4)',
                    border: '1px solid var(--color-outline-variant)',
                    color: 'var(--color-on-surface-variant)',
                    borderRadius: 'var(--radius-lg)',
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
