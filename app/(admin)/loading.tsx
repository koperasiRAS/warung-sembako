import { Loader2 } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div className="p-4 bg-primary/10 rounded-full">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
      <div className="text-center">
        <h2 className="text-lg font-headline font-semibold text-on-surface">
          Memuat Data...
        </h2>
        <p className="text-sm font-body text-outline mt-1">
          Mohon tunggu sebentar, sedang mengambil data dari server.
        </p>
      </div>
    </div>
  );
}
