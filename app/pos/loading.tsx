import { Loader2, ShoppingCart } from 'lucide-react';

export default function POSLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background gap-6">
      <div className="relative">
        <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
        <div className="relative bg-surface-container-lowest p-6 rounded-2xl shadow-ambient border border-outline-variant/20">
          <ShoppingCart className="w-12 h-12 text-primary" />
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
        <h2 className="text-xl font-headline font-bold text-on-surface">
          Membuka Kasir...
        </h2>
        <p className="text-sm font-body text-outline">
          Menyiapkan database produk dan keranjang.
        </p>
      </div>
    </div>
  );
}
