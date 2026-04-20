'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Dashboard Error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 bg-error-container text-error rounded-full flex items-center justify-center mb-6">
        <AlertTriangle size={32} />
      </div>
      
      <h2 className="text-2xl font-headline font-bold text-on-surface mb-2">
        Terjadi Kesalahan Server
      </h2>
      
      <p className="text-on-surface-variant max-w-md mx-auto mb-6">
        Maaf, sistem tidak dapat memuat data dashboard. Tim kami telah mencatat masalah ini.
      </p>

      {/* Debug Info (Tampil sementara agar bisa ditangkap error aslinya) */}
      <div className="bg-surface-container-high border border-error/20 p-4 rounded-xl text-left w-full max-w-2xl mb-8 overflow-auto">
        <p className="text-sm font-semibold text-error mb-1">Detail Error (Untuk Debugging):</p>
        <code className="text-xs text-on-surface-variant break-all font-mono">
          {error.message || 'Unknown Error'}
        </code>
        {error.digest && (
          <p className="text-xs text-outline mt-2">Digest: {error.digest}</p>
        )}
      </div>

      <button
        onClick={() => reset()}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-on-primary rounded-full font-label font-semibold hover:opacity-90 transition-opacity"
      >
        <RotateCcw size={18} />
        Coba Muat Ulang
      </button>
    </div>
  );
}
