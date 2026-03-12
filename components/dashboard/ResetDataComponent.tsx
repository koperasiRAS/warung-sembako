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

      // Success, close modal and refresh the application to clear all state
      setIsOpen(false);
      setConfirmation('');
      window.location.href = '/dashboard'; 
    } catch (err: any) {
      setError(err.message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-8 border-t border-red-200 pt-8">
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-start sm:items-center justify-between flex-col sm:flex-row gap-4">
          <div className="flex gap-4 items-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center shrink-0">
              <Database className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-800">Zona Bahaya (Danger Zone)</h3>
              <p className="text-sm text-red-600 mt-1 max-w-md">
                Tindakan ini akan menghapus permanen seluruh data toko (struk, barang, kasir, log) dan tidak bisa dikembalikan.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition shadow-sm"
          >
            <Trash2 className="w-5 h-5" />
            Reset Sistem
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-rose-100 bg-rose-50 flex justify-between items-center text-rose-800">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-6 h-6 text-rose-600" />
                <h2 className="text-lg font-bold">Konfirmasi Reset Sistem</h2>
              </div>
            </div>
            
            <form onSubmit={handleReset} className="p-6">
              <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                Anda yakin ingin menghapus <strong>seluruh data operasional</strong> (termasuk pendaftaran karyawan)? Tindakan ini <strong>tidak dapat dibatalkan</strong>!
              </p>

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm font-medium">
                  {error}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ketik <span className="text-red-600 font-bold select-all">RESET</span> untuk melanjutkan
                </label>
                <input
                  type="text"
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  className="w-full px-4 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all placeholder:text-slate-300"
                  placeholder="RESET"
                  autoComplete="off"
                />
              </div>

              <div className="flex gap-3 flex-row-reverse">
                <button
                  type="submit"
                  disabled={isSubmitting || confirmation !== 'RESET'}
                  className="flex-1 bg-red-600 text-white px-4 py-2.5 rounded-lg hover:bg-red-700 transition font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Mereset...
                    </>
                  ) : (
                    'Ya, Hapus Semua'
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
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
    </div>
  );
}
