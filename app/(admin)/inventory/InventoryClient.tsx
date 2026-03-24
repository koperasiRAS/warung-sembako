'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { InventoryTransaction, inventoryService } from '@/services/inventory.service';
import type { Product } from '@/lib/supabase/types';
import { Plus, Search, PackageMinus, PackagePlus, Store, Calendar, Loader2, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface PaginationInfo {
  page: number;
  total: number;
  totalPages: number;
  pageSize: number;
}

interface InventoryClientProps {
  initialTransactions: InventoryTransaction[];
  products: Product[];
  pagination?: PaginationInfo;
}

export default function InventoryClient({
  initialTransactions,
  products,
  pagination,
}: InventoryClientProps) {
  const router = useRouter();
  
  const [transactions, setTransactions] = useState<InventoryTransaction[]>(initialTransactions);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    product_id: '',
    quantity: '',
    cost_price: '',
    supplier_name: '',
    note: ''
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const currentParams = new URLSearchParams(window.location.search);
    const currentSearch = currentParams.get('search') || '';
    if (query === currentSearch) return; // no-op if nothing changed
    const params = new URLSearchParams(window.location.search);
    if (query) params.set('search', query);
    else params.delete('search');
    params.set('page', '1');
    router.push(`/inventory?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    if (!pagination || newPage < 1 || newPage > pagination.totalPages) return;
    const params = new URLSearchParams(window.location.search);
    params.set('page', newPage.toString());
    router.push(`/inventory?${params.toString()}`);
  };

  // Sync state from URL on mount and after navigation
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlPage = parseInt(params.get('page') || '1');
    const urlSearch = params.get('search') || '';
    setSearchQuery(urlSearch);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = () => {
    setFormData({
      product_id: '',
      quantity: '',
      cost_price: '',
      supplier_name: '',
      note: ''
    });
    setIsModalOpen(true);
  };

  const handleProductSelect = (productId: string) => {
    const selectedProduct = products.find(p => p.id === productId);
    setFormData({ 
      ...formData, 
      product_id: productId,
      // Auto-fill cost_price with existing one
      cost_price: selectedProduct?.cost_price ? selectedProduct.cost_price.toString() : ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await inventoryService.recordRestock({
        product_id: formData.product_id,
        quantity: parseInt(formData.quantity) || 0,
        cost_price: parseFloat(formData.cost_price) || 0,
        supplier_name: formData.supplier_name,
        note: formData.note
      });

      setIsModalOpen(false);
      // Reload page to get updated inventory history and product list
      router.refresh();
      toast.success('Restock berhasil disimpan!');
    } catch (error) {
      console.error('Error saving restock:', error);
      toast.error('Gagal menyimpan inventaris barang masuk. Pastikan produk dipilih.');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="p-4 lg:p-8">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Inventaris & Restock</h1>
          <p className="text-slate-500 mt-1">
            Catat barang masuk dan riwayat mutasi stok produk Anda
          </p>
        </div>
        <button
          onClick={openModal}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition"
        >
          <Plus className="w-5 h-5" />
          Catat Stok Masuk
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari transaksi inventaris..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
          />
        </div>
      </div>

      {/* Transaction List */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 font-medium text-slate-600">Tanggal</th>
                <th className="p-4 font-medium text-slate-600">Produk</th>
                <th className="p-4 font-medium text-slate-600">Tipe Mutasi</th>
                <th className="p-4 font-medium text-slate-600 text-right">Jumlah</th>
                <th className="p-4 font-medium text-slate-600 text-right">Harga Modal Dasar</th>
                <th className="p-4 font-medium text-slate-600">Catatan/Supplier</th>
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">
                    <Store className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                    Belum ada riwayat inventaris yang tercatat.
                  </td>
                </tr>
              ) : (
                transactions.map((trx) => (
                  <tr key={trx.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {formatDate(trx.created_at)}
                      </div>
                    </td>
                    <td className="p-4 font-medium text-slate-800">
                      {trx.product?.name || 'Produk Dihapus'}
                    </td>
                    <td className="p-4">
                      {trx.type === 'restock' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          <PackagePlus className="w-3.5 h-3.5" />
                          Barang Masuk
                        </span>
                      )}
                      {trx.type === 'adjustment' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Penyesuaian
                        </span>
                      )}
                      {trx.type === 'sale' && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                          <PackageMinus className="w-3.5 h-3.5" />
                          Penjualan
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right font-medium">
                      <span className={trx.quantity > 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {trx.quantity > 0 ? '+' : ''}{trx.quantity}
                      </span>
                    </td>
                    <td className="p-4 text-right text-slate-600">
                      {formatCurrency(trx.cost_price)}
                    </td>
                    <td className="p-4 text-slate-600 text-sm">
                      {trx.supplier_name ? (
                        <p className="font-medium">Dari: {trx.supplier_name}</p>
                      ) : null}
                      {trx.note && <p className="text-slate-500 truncate max-w-xs">{trx.note}</p>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-white">
          <p className="text-sm text-slate-500">
            Menampilkan {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total} transaksi
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ←
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
              .map((p, idx, arr) => {
                const showEllipsis = idx > 0 && arr[idx - 1] !== p - 1;
                const btnClass = p === pagination.page
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50';
                return (
                  <span key={p} className="flex items-center">
                    {showEllipsis ? <span className="px-2 py-1.5 text-sm text-slate-400">...</span> : null}
                    <button
                      onClick={() => handlePageChange(p)}
                      className={`px-3 py-1.5 text-sm border rounded-lg transition ${btnClass}`}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-800">
                  Catat Stok Masuk (Restock)
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Pilih Produk *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                  required
                >
                  <option value="">-- Pilih Produk yang Di-restock --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Sisa: {p.stock} | Modal Saat Ini: {formatCurrency(p.cost_price || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Jumlah Barang Masuk *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                    required
                    min="1"
                    placeholder="Misal: 50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Harga Modal Pembelian *
                  </label>
                  <input
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
                    required
                    min="0"
                    placeholder="Harga satuan"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nama Supplier / Penyuplai (Opsional)
                </label>
                <input
                  type="text"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  placeholder="Misal: Agen Berkah, Toko Makmur"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600"
                  rows={2}
                  placeholder="Nota no. 12345 atau keterangan lainnya"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Simpan Barang Masuk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
