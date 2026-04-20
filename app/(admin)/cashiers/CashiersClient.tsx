'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Search, Mail, ShieldAlert, BadgeCheck, Loader2, Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function CashiersClient({ initialCashiers }: { initialCashiers: any[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [cashiers, setCashiers] = useState(initialCashiers);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [isEditing, setIsEditing] = useState<any>(null);
  const [editFormData, setEditFormData] = useState({ fullName: '', password: '' });
  const [isDeleting, setIsDeleting] = useState<any>(null);

  const handleEditCashier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isEditing) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/cashiers/${isEditing.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: editFormData.fullName,
          password: editFormData.password || undefined // Only send if provided
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal mengubah kasir');

      // Update local state
      setCashiers(cashiers.map(c => 
        c.id === isEditing.id ? { ...c, full_name: editFormData.fullName } : c
      ));

      setIsEditing(null);
      setEditFormData({ fullName: '', password: '' });
      router.refresh();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCashier = async () => {
    if (!isDeleting) return;
    setIsSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/cashiers/${isDeleting.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menghapus kasir');

      // Update local state
      setCashiers(cashiers.filter(c => c.id !== isDeleting.id));
      setIsDeleting(null);
      router.refresh();
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };


  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
      }} className="sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)',
            fontWeight: '700', color: 'var(--color-on-surface)', letterSpacing: 'var(--tracking-tight)',
          }}>
            Manajemen Kasir
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
            color: 'var(--color-outline)', marginTop: 'var(--space-1)',
          }}>
            Kelola akun kasir melalui Supabase Dashboard untuk akses ke sistem POS
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
                {['Nama Kasir', 'Email / Login', 'Status Akun', 'Bergabung Pada', 'Aksi'].map((h) => (
                  <th key={h} style={{
                    padding: 'var(--space-4)',
                    textAlign: h.includes('Aksi') ? 'right' : 'left',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashiers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 'var(--space-12)', textAlign: 'center' }}>
                    <Users style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-3)' }} />
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-on-surface-variant)' }}>Belum ada kasir</p>
                    <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-1)' }}>Tambahkan akun kasir melalui dashboard otentikasi Supabase.</p>
                  </td>
                </tr>
              ) : (
                cashiers.map((cashier) => (
                  <tr key={cashier.id} style={{ borderBottom: '1px solid var(--color-outline-variant)', transition: 'background-color var(--transition-fast)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <div style={{
                          width: '2rem', height: '2rem', borderRadius: 'var(--radius-full)',
                          backgroundColor: 'var(--color-tertiary-fixed)', color: 'var(--color-tertiary)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontFamily: 'var(--font-heading)', fontWeight: '700',
                          fontSize: 'var(--text-body-sm)',
                        }}>
                          {(cashier.full_name || 'K')[0].toUpperCase()}
                        </div>
                        <span style={{ fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                          {cashier.full_name || cashier.email.split('@')[0]}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                        <Mail style={{ width: '1rem', height: '1rem' }} />
                        {cashier.email}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-4)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)', fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', fontWeight: '600', backgroundColor: 'var(--color-tertiary-fixed)', color: 'var(--color-tertiary)' }}>
                        <BadgeCheck style={{ width: '0.875rem', height: '0.875rem' }} /> Aktif
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)' }}>
                      {formatDate(cashier.created_at)}
                    </td>
                    <td style={{ padding: 'var(--space-4)', textAlign: 'right' }}>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-1)' }}>
                        <button
                          onClick={() => { setIsEditing(cashier); setEditFormData({ fullName: cashier.full_name || '', password: '' }); setError(''); }}
                          title="Edit Kasir"
                          style={{ padding: 'var(--space-2)', color: 'var(--color-outline)', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-primary-fixed)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-outline)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Pencil style={{ width: '1rem', height: '1rem' }} />
                        </button>
                        <button
                          onClick={() => { setIsDeleting(cashier); setError(''); }}
                          title="Hapus Kasir"
                          style={{ padding: 'var(--space-2)', color: 'var(--color-outline)', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all var(--transition-fast)' }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--color-error)'; e.currentTarget.style.backgroundColor = 'var(--color-error-container)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--color-outline)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
                        >
                          <Trash2 style={{ width: '1rem', height: '1rem' }} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Cashier Modal */}
      {isEditing && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(30,27,75,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '28rem',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-overlay)',
            animation: 'fadeIn 200ms ease',
          }}>
            <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-outline-variant)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-on-surface)' }}>Edit Akun Kasir</h2>
            </div>

            <form onSubmit={handleEditCashier} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {error && (
                <div style={{ padding: 'var(--space-3)', backgroundColor: 'var(--color-error-container)', color: 'var(--color-error)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <ShieldAlert style={{ width: '1rem', height: '1rem' }} />
                  {error}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({...editFormData, fullName: e.target.value})}
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
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>Password Baru (Opsional)</label>
                  <input
                    type="password"
                    minLength={6}
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({...editFormData, password: e.target.value})}
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
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    placeholder="Kosongkan jika tidak ingin mengubah password"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)', flexDirection: 'row-reverse' }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: 'calc(var(--space-2) + 2px) var(--space-4)',
                    backgroundColor: isSubmitting ? 'var(--color-surface-container)' : 'var(--color-primary)',
                    color: isSubmitting ? 'var(--color-outline)' : 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />}
                  Simpan Perubahan
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(null)}
                  disabled={isSubmitting}
                  style={{
                    flex: 1,
                    padding: 'calc(var(--space-2) + 2px) var(--space-4)',
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

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(30,27,75,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '24rem',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-overlay)',
            animation: 'fadeIn 200ms ease',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '4rem', height: '4rem', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-error-container)', margin: '0 auto var(--space-4)' }}>
              <Trash2 style={{ width: '2rem', height: '2rem', color: 'var(--color-error)' }} />
            </div>
            <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-on-surface)', textAlign: 'center', marginBottom: 'var(--space-2)' }}>Hapus Kasir?</h2>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)', textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              Anda yakin ingin menghapus akun kasir <span style={{ fontWeight: '600', color: 'var(--color-on-surface)' }}>{isDeleting.full_name || isDeleting.email}</span>? Data tidak dapat dikembalikan.
            </p>

            {error && (
              <div style={{ padding: 'var(--space-3)', marginBottom: 'var(--space-6)', backgroundColor: 'var(--color-error-container)', color: 'var(--color-error)', border: '1px solid var(--color-error)', borderRadius: 'var(--radius-lg)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)' }}>
                <ShieldAlert style={{ width: '1rem', height: '1rem', flexShrink: '0', marginTop: '1px' }} />
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                onClick={() => setIsDeleting(null)}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: 'calc(var(--space-2) + 2px) var(--space-4)',
                  border: '1px solid var(--color-outline-variant)',
                  color: 'var(--color-on-surface-variant)',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  cursor: 'pointer', backgroundColor: 'transparent',
                }}
              >
                Batal
              </button>
              <button
                onClick={handleDeleteCashier}
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: 'calc(var(--space-2) + 2px) var(--space-4)',
                  backgroundColor: isSubmitting ? 'var(--color-surface-container)' : 'var(--color-error)',
                  color: 'var(--color-on-error)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                }}
              >
                {isSubmitting && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />}
                Ya, Hapus
              </button>
            </div>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }`}</style>
        </div>
      )}
    </div>
  );
}
