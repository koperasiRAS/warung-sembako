'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Product, Category } from '@/lib/supabase/types';
import { uploadProductImage, deleteProductImage, generateSKU } from '@/lib/utils/image-upload';
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Package,
  X,
  Loader2,
  Upload,
  Barcode,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PaginationInfo {
  page: number;
  total: number;
  totalPages: number;
  pageSize: number;
}

interface ProductsClientProps {
  initialProducts: Product[];
  initialCategories: Category[];
  pagination?: PaginationInfo;
}

export default function ProductsClient({
  initialProducts,
  initialCategories,
  pagination,
}: ProductsClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState(initialProducts);
  const [categories, setCategories] = useState(initialCategories);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync state with props in case of server-side data refresh
  useEffect(() => {
    setProducts(initialProducts);
  }, [initialProducts]);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  // Realtime: update categories dropdown when categories table changes
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('categories-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'categories' },
        async () => {
          const { data } = await supabase
            .from('categories')
            .select('*')
            .order('name', { ascending: true });
          if (data) setCategories(data as Category[]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    price: '',
    cost_price: '',
    stock: '',
    low_stock_threshold: '10',
    category_id: '',
    barcode: '',
    sku: '',
    image_url: '',
    imageFile: null as File | null,
  });

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    if (selectedCategory) params.set('category', selectedCategory);
    params.set('page', '1');
    router.push(`/products?${params.toString()}`);
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (categoryId) params.set('category', categoryId);
    params.set('page', '1');
    router.push(`/products?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('search', searchQuery);
    if (selectedCategory) params.set('category', selectedCategory);
    params.set('page', newPage.toString());
    router.push(`/products?${params.toString()}`);
  };

  const openModal = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        price: product.price.toString(),
        cost_price: product.cost_price?.toString() || '0',
        stock: product.stock.toString(),
        low_stock_threshold: (product.low_stock_threshold || 10).toString(),
        category_id: product.category_id || '',
        barcode: product.barcode || '',
        sku: product.sku || '',
        image_url: product.image_url || '',
        imageFile: null,
      });
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        price: '',
        cost_price: '',
        stock: '',
        low_stock_threshold: '10',
        category_id: '',
        barcode: '',
        sku: '',
        image_url: '',
        imageFile: null,
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setFormData({
      name: '',
      price: '',
      cost_price: '',
      stock: '',
      low_stock_threshold: '10',
      category_id: '',
      barcode: '',
      sku: '',
      image_url: '',
      imageFile: null,
    });
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Pilih gambar dengan format JPG, PNG, atau WebP');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Ukuran gambar maksimal 2MB');
      return;
    }

    setFormData((prev) => ({ 
      ...prev, 
      imageFile: file, 
      image_url: URL.createObjectURL(file) 
    }));
  };

  const handleGenerateSKU = () => {
    const sku = generateSKU();
    setFormData({ ...formData, sku });
  };

  const handleGenerateBarcode = () => {
    // Generate random 12-digit barcode
    const barcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData({ ...formData, barcode });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // ===== INPUT VALIDATION =====
    const name = formData.name.trim();
    const price = parseFloat(formData.price);
    const costPrice = parseFloat(formData.cost_price) || 0;
    const stock = parseInt(formData.stock);

    // Validate product name
    if (!name || name.length < 2) {
      toast.error('Nama produk minimal 2 karakter!');
      setLoading(false);
      return;
    }

    // Validate price
    if (isNaN(price) || price <= 0) {
      toast.error('Harga jual harus lebih dari 0!');
      setLoading(false);
      return;
    }

    // Validate cost price
    if (isNaN(costPrice) || costPrice < 0) {
      toast.error('Harga modal tidak boleh negatif!');
      setLoading(false);
      return;
    }

    // Validate selling price >= cost price
    if (price < costPrice) {
      toast.error('Harga jual tidak boleh lebih kecil dari harga modal! Ini berarti menjual rugi.');
      setLoading(false);
      return;
    }

    // Validate stock
    if (isNaN(stock) || stock < 0) {
      toast.error('Stok tidak boleh negatif!');
      setLoading(false);
      return;
    }

    // Validate barcode (if provided, must be alphanumeric)
    if (formData.barcode && !/^[a-zA-Z0-9]+$/.test(formData.barcode)) {
      toast.error('Barcode hanya boleh mengandung huruf dan angka!');
      setLoading(false);
      return;
    }
    // ===== END VALIDATION =====

    try {
      let imageUrl = formData.image_url;

      // Upload image if a new file was selected
      if (formData.imageFile) {
        setUploadingImage(true);
        const productId = editingProduct?.id || crypto.randomUUID();
        const result = await uploadProductImage(formData.imageFile, productId);

        if (!result.success) {
          toast.error(result.error || 'Gagal mengunggah foto');
          setLoading(false);
          setUploadingImage(false);
          return;
        }

        imageUrl = result.url || '';
        setUploadingImage(false);
      }

      const productData = {
        name: name,
        price: price,
        cost_price: costPrice,
        stock: stock,
        low_stock_threshold: parseInt(formData.low_stock_threshold) || 10,
        category_id: formData.category_id || null,
        barcode: formData.barcode || null,
        sku: formData.sku || null,
        image_url: imageUrl || null,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editingProduct.id);

        if (error) throw error;

        setProducts(
          (products ?? []).map((p) =>
            p.id === editingProduct.id ? { ...p, ...productData } : p
          )
        );
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (error) throw error;

        // Get category for the new product
        const category = categories.find((c) => c.id === data.category_id);
        setProducts([...products, { ...data, category }]);
      }

      closeModal();
      router.refresh();
      toast.success('Produk berhasil disimpan!');
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error('Gagal menyimpan produk. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setLoading(true);
    try {
      // Get product to delete image
      const product = products.find((p) => p.id === id);
      if (product?.image_url) {
        await deleteProductImage(product.image_url);
      }

      const { error } = await supabase.from('products').delete().eq('id', id);

      if (error) throw error;

      setProducts(products.filter((p) => p.id !== id));
      setDeleteConfirm(null);
      router.refresh();
      toast.success('Produk berhasil dihapus!');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Gagal menghapus produk!');
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

  return (
    <div style={{ padding: 'var(--space-4)' }} className="lg:p-8">
      {/* Header */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }} className="lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'var(--text-headline-sm)',
            fontWeight: '700',
            color: 'var(--color-on-surface)',
          }}>
            Produk
          </h1>
          <p style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-md)',
            color: 'var(--color-outline)',
            marginTop: 'var(--space-1)',
          }}>
            Kelola inventaris produk Anda ({pagination?.total || products.length} item)
          </p>
        </div>
        <button
          onClick={() => openModal()}
          style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            background: 'var(--gradient-primary)',
            color: 'var(--color-on-primary)',
            border: 'none', borderRadius: 'var(--radius-lg)',
            fontFamily: 'var(--font-label)', fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          <Plus style={{ width: '1.25rem', height: '1.25rem' }} />
          Tambah Produk
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }} className="lg:flex-row">
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', width: '1.25rem', height: '1.25rem', color: 'var(--color-outline)' }} />
          <input
            type="text"
            placeholder="Cari nama, barcode, atau SKU..."
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
            onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => handleCategoryChange(e.target.value)}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            border: '1.5px solid var(--color-outline-variant)',
            borderRadius: 'var(--radius-lg)',
            outline: 'none',
            backgroundColor: 'var(--color-surface-container-high)',
            color: 'var(--color-on-surface)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-body-md)',
            cursor: 'pointer',
            minWidth: '10rem',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
        >
          <option value="" style={{ color: 'var(--color-outline)' }}>Semua Kategori</option>
          {(categories ?? []).map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.name}
            </option>
          ))}
        </select>
      </div>

      {/* Products Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: 'var(--space-4)',
      }} className="md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {(filteredProducts ?? []).map((product) => (
          <div
            key={product.id}
            style={{
              backgroundColor: 'var(--color-surface-container-lowest)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--color-outline-variant)',
              overflow: 'hidden',
              transition: 'box-shadow var(--transition-base)',
              cursor: 'default',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
          >
            {/* Image */}
            <div style={{
              aspectRatio: '1',
              backgroundColor: 'var(--color-surface-dim)',
              position: 'relative',
            }}>
              {product.image_url ? (
                <img
                  src={product.image_url}
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)' }} />
                </div>
              )}
              {product.stock < (product.low_stock_threshold || 10) && (
                <span style={{
                  position: 'absolute',
                  top: 'var(--space-2)',
                  right: 'var(--space-2)',
                  padding: '2px var(--space-2)',
                  backgroundColor: 'var(--color-warning)',
                  color: 'var(--color-on-secondary)',
                  fontFamily: 'var(--font-label)',
                  fontSize: 'var(--text-label-sm)',
                  fontWeight: '600',
                  borderRadius: 'var(--radius-full)',
                }}>
                  Stok Menipis
                </span>
              )}
            </div>

            {/* Info */}
            <div style={{ padding: 'var(--space-3)' }}>
              <h3 style={{
                fontFamily: 'var(--font-body)',
                fontWeight: '600',
                color: 'var(--color-on-surface)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }} title={product.name}>
                {product.name}
              </h3>
              <p style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: '700',
                fontSize: 'var(--text-title-lg)',
                color: 'var(--color-primary)',
                marginTop: 'var(--space-1)',
              }}>
                {formatCurrency(product.price)}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                <span style={{
                  fontFamily: 'var(--font-label)',
                  fontSize: 'var(--text-label-sm)',
                  color: 'var(--color-outline)',
                }}>
                  Stok: {product.stock}
                </span>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button
                    onClick={() => openModal(product)}
                    title="Edit"
                    style={{
                      padding: 'var(--space-1)',
                      color: 'var(--color-outline)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-primary)';
                      e.currentTarget.style.backgroundColor = 'var(--color-primary-fixed)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-outline)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Edit style={{ width: '1rem', height: '1rem' }} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(product.id)}
                    title="Hapus"
                    style={{
                      padding: 'var(--space-1)',
                      color: 'var(--color-outline)',
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--color-error)';
                      e.currentTarget.style.backgroundColor = 'var(--color-error-container)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--color-outline)';
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Trash2 style={{ width: '1rem', height: '1rem' }} />
                  </button>
                </div>
              </div>
              {product.barcode && (
                <p style={{
                  fontFamily: 'var(--font-label)',
                  fontSize: 'var(--text-label-sm)',
                  color: 'var(--color-outline)',
                  marginTop: 'var(--space-1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  Barcode: {product.barcode}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div style={{ textAlign: 'center', paddingTop: 'var(--space-12)', paddingBottom: 'var(--space-12)' }}>
          <Package style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-4)' }} />
          <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>Produk tidak ditemukan</p>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 'var(--space-2)',
          marginTop: 'var(--space-6)',
        }}>
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page <= 1}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'transparent',
              cursor: pagination.page <= 1 ? 'not-allowed' : 'pointer',
              opacity: pagination.page <= 1 ? '0.4' : '1',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            <ChevronLeft style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
          <span style={{
            fontFamily: 'var(--font-label)',
            fontSize: 'var(--text-label-sm)',
            color: 'var(--color-on-surface-variant)',
          }}>
            Halaman {pagination.page} dari {pagination.totalPages}
          </span>
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page >= pagination.totalPages}
            style={{
              padding: 'var(--space-2)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--color-outline-variant)',
              backgroundColor: 'transparent',
              cursor: pagination.page >= pagination.totalPages ? 'not-allowed' : 'pointer',
              opacity: pagination.page >= pagination.totalPages ? '0.4' : '1',
              color: 'var(--color-on-surface-variant)',
            }}
          >
            <ChevronRight style={{ width: '1.25rem', height: '1.25rem' }} />
          </button>
        </div>
      )}

      {/* Modal */}
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
                  {editingProduct ? 'Edit Produk' : 'Tambah Produk'}
                </h2>
                <button
                  onClick={closeModal}
                  style={{
                    padding: 'var(--space-2)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--color-outline)',
                  }}
                >
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Image Upload */}
              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Foto Produk
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: '2px dashed var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-4)',
                    textAlign: 'center',
                    cursor: 'pointer',
                    transition: 'border-color var(--transition-base)',
                    backgroundColor: 'var(--color-surface-container)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
                >
                  {formData.image_url ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={formData.image_url}
                        alt="Preview"
                        style={{ width: '8rem', height: '8rem', objectFit: 'cover', borderRadius: 'var(--radius-lg)', margin: '0 auto' }}
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, image_url: '', imageFile: null });
                        }}
                        style={{
                          position: 'absolute',
                          top: '-0.5rem',
                          right: '-0.5rem',
                          padding: 'var(--space-1)',
                          backgroundColor: 'var(--color-error)',
                          color: 'var(--color-on-error)',
                          border: 'none',
                          borderRadius: 'var(--radius-full)',
                          cursor: 'pointer',
                        }}
                      >
                        <X style={{ width: '0.75rem', height: '0.75rem' }} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)' }}>
                      <Upload style={{ width: '2rem', height: '2rem', color: 'var(--color-outline)', margin: '0 auto var(--space-2)' }} />
                      <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)' }}>Klik untuk unggah foto</p>
                      <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-1)' }}>JPG, PNG, WebP (maks 2MB)</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  style={{ display: 'none' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Nama Produk *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-md)',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4)' }} className="grid-cols-1 md:grid-cols-4">
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Harga Modal *
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
                      fontSize: 'var(--text-body-md)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    required min="0" step="100" placeholder="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Harga Jual *
                  </label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-body-md)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    required min="0" step="100" placeholder="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Stok *
                  </label>
                  <input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-body-md)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    required min="0" placeholder="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Batas Stok Rendah
                  </label>
                  <input
                    type="number"
                    value={formData.low_stock_threshold}
                    onChange={(e) => setFormData({ ...formData, low_stock_threshold: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-body)',
                      fontSize: 'var(--text-body-md)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    min="0" placeholder="10"
                  />
                  <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-1)' }}>
                    Tanda "Stok Menipis" jika di bawah angka ini
                  </p>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                  Kategori
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  style={{
                    width: '100%',
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1.5px solid var(--color-outline-variant)',
                    borderRadius: 'var(--radius-lg)',
                    outline: 'none',
                    backgroundColor: 'var(--color-surface-container-high)',
                    color: 'var(--color-on-surface)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-md)',
                    cursor: 'pointer',
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
                >
                  <option value="">Pilih Kategori</option>
                  {(categories ?? []).map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    Barcode
                    <button
                      type="button"
                      onClick={handleGenerateBarcode}
                      title="Buat barcode otomatis"
                      style={{
                        padding: 'var(--space-1)',
                        color: 'var(--color-primary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                    >
                      <Barcode style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-body-md)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    placeholder="Ketik atau buat otomatis"
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)' }}>
                    SKU
                    <button
                      type="button"
                      onClick={handleGenerateSKU}
                      title="Buat SKU otomatis"
                      style={{
                        padding: 'var(--space-1)',
                        color: 'var(--color-primary)',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                      }}
                    >
                      <Plus style={{ width: '1rem', height: '1rem' }} />
                    </button>
                  </label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    style={{
                      width: '100%',
                      padding: 'var(--space-2) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 'var(--text-body-md)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)'; }}
                    placeholder="Ketik atau buat otomatis"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)', paddingTop: 'var(--space-4)' }}>
                <button
                  type="button"
                  onClick={closeModal}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2) var(--space-4)',
                    border: '1px solid var(--color-outline-variant)',
                    color: 'var(--color-on-surface-variant)',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    cursor: 'pointer',
                    backgroundColor: 'transparent',
                  }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading || uploadingImage}
                  style={{
                    flex: 1,
                    padding: 'var(--space-2) var(--space-4)',
                    backgroundColor: (loading || uploadingImage) ? 'var(--color-surface-container)' : 'var(--color-primary)',
                    color: (loading || uploadingImage) ? 'var(--color-outline)' : 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-label)', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: (loading || uploadingImage) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {(loading || uploadingImage) && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />}
                  {uploadingImage ? 'Mengunggah...' : editingProduct ? 'Simpan' : 'Buat Baru'}
                </button>
              </div>
            </form>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: 'var(--radius-xl)',
            width: '100%', maxWidth: '24rem',
            padding: 'var(--space-6)',
            boxShadow: 'var(--shadow-overlay)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--color-error-container)', borderRadius: 'var(--radius-full)' }}>
                <Trash2 style={{ width: '1.25rem', height: '1.25rem', color: 'var(--color-error)' }} />
              </div>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                Hapus Produk?
              </h3>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)', color: 'var(--color-outline)', marginBottom: 'var(--space-6)' }}>
              Tindakan ini tidak bisa dibatalkan. Ini akan menghapus data produk secara permanen.
            </p>
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <button
                onClick={() => setDeleteConfirm(null)}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-4)',
                  border: '1px solid var(--color-outline-variant)',
                  color: 'var(--color-on-surface-variant)',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  cursor: 'pointer',
                  backgroundColor: 'transparent',
                }}
              >
                Batal
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: 'var(--space-2) var(--space-4)',
                  backgroundColor: loading ? 'var(--color-surface-container)' : 'var(--color-error)',
                  color: loading ? 'var(--color-outline)' : 'var(--color-on-error)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-label)', fontWeight: '600',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? '0.5' : '1',
                }}
              >
                {loading && <Loader2 style={{ width: '1rem', height: '1rem', animation: 'spin 0.6s linear infinite' }} />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}