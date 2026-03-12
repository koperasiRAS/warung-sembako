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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">Manajemen Kasir</h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola akun kasir melalui Supabase Dashboard untuk akses ke sistem POS
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-medium">Nama Kasir</th>
                <th className="px-6 py-4 font-medium">Email / Login</th>
                <th className="px-6 py-4 font-medium">Status Akun</th>
                <th className="px-6 py-4 font-medium">Bergabung Pada</th>
                <th className="px-6 py-4 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {cashiers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                    <p className="font-medium text-slate-600">Belum ada kasir</p>
                    <p className="text-sm mt-1">Tambahkan akun kasir melalui dashboard otentikasi Supabase.</p>
                  </td>
                </tr>
              ) : (
                cashiers.map((cashier) => (
                  <tr key={cashier.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center font-bold">
                          {(cashier.full_name || 'K')[0].toUpperCase()}
                        </div>
                        <span className="font-medium text-slate-800">
                          {cashier.full_name || cashier.email.split('@')[0]}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Mail className="w-4 h-4" />
                        {cashier.email}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                         <BadgeCheck className="w-3.5 h-3.5" /> Aktif
                       </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {formatDate(cashier.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setIsEditing(cashier);
                            setEditFormData({ fullName: cashier.full_name || '', password: '' });
                            setError('');
                          }}
                          className="p-2 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg transition"
                          title="Edit Kasir"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setIsDeleting(cashier);
                            setError('');
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus Kasir"
                        >
                          <Trash2 className="w-4 h-4" />
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
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800">Edit Akun Kasir</h2>
            </div>
            
            <form onSubmit={handleEditCashier} className="p-6">
              {error && (
                <div className="mb-6 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={editFormData.fullName}
                    onChange={(e) => setEditFormData({...editFormData, fullName: e.target.value})}
                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru (Opsional)</label>
                  <input
                    type="password"
                    minLength={6}
                    value={editFormData.password}
                    onChange={(e) => setEditFormData({...editFormData, password: e.target.value})}
                    className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="Kosongkan jika tidak ingin mengubah password"
                  />
                </div>
              </div>

              <div className="mt-8 flex gap-3 flex-row-reverse">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-primary text-white px-4 py-2.5 rounded-lg hover:bg-primary-dark transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Simpan Perubahan'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditing(null)}
                  disabled={isSubmitting}
                  className="flex-1 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition font-medium"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleting && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Hapus Kasir?</h2>
              <p className="text-sm text-slate-600 mb-6">
                Anda yakin ingin menghapus akun kasir <span className="font-semibold text-slate-800">{isDeleting.full_name || isDeleting.email}</span>? Data tidak dapat dikembalikan.
              </p>
              
              {error && (
                <div className="mb-6 mx-auto p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm flex items-center gap-2 text-left">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setIsDeleting(null)}
                  disabled={isSubmitting}
                  className="flex-1 border border-slate-300 text-slate-700 px-4 py-2.5 rounded-lg hover:bg-slate-50 transition font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={handleDeleteCashier}
                  disabled={isSubmitting}
                  className="flex-1 bg-rose-600 text-white px-4 py-2.5 rounded-lg hover:bg-rose-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Ya, Hapus'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
