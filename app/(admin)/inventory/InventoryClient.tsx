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
    <div style={{ padding: 'var(--space-4)' }} className="lg:p-8">
      {/* Header */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }} className="lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)', fontSize: 'var(--text-headline-sm)',
            fontWeight: '700', color: 'var(--color-on-surface)',
          }}>
            Inventaris & Restock
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)',
            color: 'var(--color-outline)', marginTop: 'var(--space-1)',
          }}>
            Catat barang masuk dan riwayat mutasi stok produk Anda
          </p>
        </div>
        <button
          onClick={openModal}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--color-tertiary)',
            color: 'var(--color-on-primary)',
            border: 'none', borderRadius: 'var(--radius-lg)',
            fontFamily: 'var(--font-label)', fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <Plus style={{ width: '1.25rem', height: '1.25rem' }} />
          Catat Stok Masuk
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }} className="lg:flex-row">
        <div style={{ position: 'relative', flex: 1, maxWidth: '28rem' }}>
          <Search style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: 'var(--color-outline)' }} />
          <input
            type="text"
            placeholder="Cari transaksi inventaris..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '2.5rem',
              paddingRight: 'var(--space-4)',
              paddingTop: 'var(--space-2)',
              paddingBottom: 'var(--space-2)',
              border: '1.5px solid var(--color-outline-variant)',
              borderRadius: 'var(--radius-lg)',
              outline: 'none',
              backgroundColor: 'var(--color-surface-container-high)',
              color: 'var(--color-on-surface)',
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-body-md)',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-tertiary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
          />
        </div>
      </div>

      {/* Transaction List */}
      <div style={{
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--color-outline-variant)',
        overflow: 'hidden',
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--color-surface-container)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                {['Tanggal', 'Produk', 'Tipe Mutasi', 'Jumlah', 'Harga Modal Dasar', 'Catatan/Supplier'].map((header) => (
                  <th key={header} style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontFamily: 'var(--font-label)',
                    fontSize: 'var(--text-label-sm)',
                    fontWeight: '600',
                    color: 'var(--color-on-surface-variant)',
                    letterSpacing: 'var(--tracking-wide)',
                    textAlign: header.includes('Harga') || header.includes('Jumlah') ? 'right' : 'left',
                  }}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 'var(--space-8)', textAlign: 'center' }}>
                    <Store style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-3)' }} />
                    <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>Belum ada riwayat inventaris yang tercatat.</p>
                  </td>
                </tr>
              ) : (
                transactions.map((trx) => (
                  <tr key={trx.id} style={{ borderBottom: '1px solid var(--color-outline-variant)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                        <Calendar style={{ width: '1rem', height: '1rem', color: 'var(--color-outline)' }} />
                        {formatDate(trx.created_at)}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-body)', fontWeight: '600', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)' }}>
                      {trx.product?.name || 'Produk Dihapus'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                      {trx.type === 'restock' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)', fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', fontWeight: '600', backgroundColor: 'var(--color-tertiary-fixed)', color: 'var(--color-tertiary)' }}>
                          <PackagePlus style={{ width: '0.875rem', height: '0.875rem' }} />
                          Barang Masuk
                        </span>
                      )}
                      {trx.type === 'adjustment' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)', fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', fontWeight: '600', backgroundColor: 'var(--color-bank-fixed)', color: 'var(--color-bank)' }}>
                          Penyesuaian
                        </span>
                      )}
                      {trx.type === 'sale' && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1)', padding: '2px var(--space-2)', borderRadius: 'var(--radius-full)', fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-xs)', fontWeight: '600', backgroundColor: '#fef3c7', color: '#92400e' }}>
                          <PackageMinus style={{ width: '0.875rem', height: '0.875rem' }} />
                          Penjualan
                        </span>
                      )}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: 'var(--text-body-sm)', color: trx.quantity > 0 ? 'var(--color-tertiary)' : 'var(--color-error)' }}>
                      {trx.quantity > 0 ? '+' : ''}{trx.quantity}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                      {formatCurrency(trx.cost_price)}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface-variant)' }}>
                      {trx.supplier_name ? (
                        <p style={{ fontWeight: '600', color: 'var(--color-on-surface)' }}>Dari: {trx.supplier_name}</p>
                      ) : null}
                      {trx.note && <p style={{ color: 'var(--color-outline)', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '12rem', whiteSpace: 'nowrap' }}>{trx.note}</p>}
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
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-3) var(--space-4)',
          borderTop: '1px solid var(--color-outline-variant)',
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderRadius: '0 0 var(--radius-xl) var(--radius-xl)',
        }}>
          <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>
            Menampilkan {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} dari {pagination.total} transaksi
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                color: 'var(--color-on-surface-variant)',
                backgroundColor: 'transparent',
                cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
                opacity: pagination.page <= 1 ? '0.4' : '1',
              }}
            >
              ←
            </button>
            {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
              .map((p, idx, arr) => {
                const showEllipsis = idx > 0 && arr[idx - 1] !== p - 1;
                const isActive = p === pagination.page;
                return (
                  <span key={p} style={{ display: 'flex', alignItems: 'center' }}>
                    {showEllipsis ? <span style={{ padding: 'var(--space-1) var(--space-2)', fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }}>...</span> : null}
                    <button
                      onClick={() => handlePageChange(p)}
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--color-tertiary)' : 'var(--color-outline-variant)',
                        borderRadius: 'var(--radius-md)',
                        fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                        backgroundColor: isActive ? 'var(--color-tertiary)' : 'transparent',
                        color: isActive ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                        cursor: 'pointer',
                        transition: 'all var(--transition-fast)',
                      }}
                    >
                      {p}
                    </button>
                  </span>
                );
              })}
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                border: '1px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                color: 'var(--color-on-surface-variant)',
                backgroundColor: 'transparent',
                cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
                opacity: pagination.page >= pagination.totalPages ? '0.4' : '1',
              }}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '32rem',
            maxHeight: '90dvh', overflowY: 'auto',
            boxShadow: 'var(--shadow-overlay)',
          }}>
            <div style={{ padding: 'var(--space-6)', borderBottom: '1px solid var(--color-outline-variant)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                  Catat Stok Masuk (Restock)
                </h2>
                <button onClick={() => setIsModalOpen(false)} style={{ padding: 'var(--space-2)', backgroundColor: 'transparent', border: 'none', borderRadius: 'var(--radius-md)', cursor: 'pointer', color: 'var(--color-outline)' }}>
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Pilih Produk *
                </label>
                <select
                  value={formData.product_id}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                    cursor: 'pointer',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-tertiary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  required
                >
                  <option value="" style={{ color: 'var(--color-outline)' }}>-- Pilih Produk yang Di-restock --</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Sisa: {p.stock} | Modal Saat Ini: {formatCurrency(p.cost_price || 0)})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Jumlah Barang Masuk *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-body)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-tertiary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    required min="1" placeholder="Misal: 50"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Harga Modal Pembelian *
                  </label>
                  <input
                    type="number"
                    value={formData.cost_price}
                    onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-body)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-tertiary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    required min="0" placeholder="Harga satuan"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Nama Supplier / Penyuplai (Opsional)
                </label>
                <input
                  type="text"
                  value={formData.supplier_name}
                  onChange={(e) => setFormData({ ...formData, supplier_name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-tertiary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  placeholder="Misal: Agen Berkah, Toko Makmur"
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  value={formData.note}
                  onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                    resize: 'none',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-tertiary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  rows={2}
                  placeholder="Nota no. 12345 atau keterangan lainnya"
                />
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2) var(--space-4)',
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
                  type="submit"
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2) var(--space-4)',
                    backgroundColor: loading ? 'var(--color-surface-container)' : 'var(--color-tertiary)',
                    color: loading ? 'var(--color-outline)' : 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />}
                  Simpan Barang Masuk
                </button>
              </div>
            </form>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}
