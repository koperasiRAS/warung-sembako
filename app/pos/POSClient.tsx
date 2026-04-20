'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import type { Product, Category } from '@/lib/supabase/types';
import { useDebounce } from '@/hooks/useDebounce';
import { ThermalReceipt } from '@/components/pos/ThermalReceipt';
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  QrCode,
  CreditCard,
  Banknote,
  Printer,
  Package,
  RotateCcw,
  Calculator,
  BookUser,
} from 'lucide-react';
interface POSClientProps {
  initialProducts: Product[];
  initialCategories: Category[];
  user: { id: string; email: string };
}

// Local cart item type (not from DB)
interface LocalCartItem {
  product_id: string;
  product_name: string;
  price: number;
  qty: number;
  stock: number;
  image_url: string | null;
}

export default function POSClient({
  initialProducts,
  initialCategories,
  user,
}: POSClientProps) {
  const supabase = createClient();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // State
  const [products, setProducts] = useState(initialProducts);
  const [categories] = useState(initialCategories);
  const [cart, setCart] = useState<LocalCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<{
    id: string;
    created_at: string;
    total: number;
    payment_method: string;
    cashier?: { full_name: string | null };
    items: { product?: { name: string }; qty: number; price: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [scannerActive, setScannerActive] = useState(true);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer' | 'hutang'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [customerName, setCustomerName] = useState('');

  // Barcode scanning state
  const barcodeBufferRef = useRef('');
  const lastKeyTimeRef = useRef(0);

  // Load cart from localStorage on mount — validate stock against current DB state
  useEffect(() => {
    const savedCart = localStorage.getItem('pos_cart');
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart) as LocalCartItem[];
        // Validate: only keep items where stock > 0 and price matches DB
        const validCart = parsedCart.filter((item) => {
          const product = initialProducts.find((p) => p.id === item.product_id);
          if (!product || product.stock <= 0) return false;
          // Remove items with stale prices (allow 1% tolerance for rounding)
          if (Math.abs(product.price - item.price) > product.price * 0.01) return false;
          return true;
        });
        setCart(validCart);
        if (validCart.length < parsedCart.length) {
          toast('Beberapa item di keranjang sudah tidak valid dan dihapus.');
        }
      } catch (e) {
        console.error('Failed to load cart:', e);
        localStorage.removeItem('pos_cart');
      }
    }
  }, [initialProducts]);

  // Save cart to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('pos_cart', JSON.stringify(cart));
  }, [cart]);

  // Refetch products from DB (used for realtime sync)
  const refetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from('products')
      .select('*, category:categories(*)')
      .gt('stock', 0)
      .order('name', { ascending: true });
    if (data) setProducts(data as Product[]);
  }, [supabase]);

  // Realtime: listen to products table changes and refetch
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('pos-products-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => { refetchProducts(); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchProducts]);

  // Filter products - memoized for performance
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];

    const searchQuery = debouncedSearch ?? '';
    const searchLower = searchQuery.toLowerCase();

    return products.filter((product) => {
      // Skip if product is undefined
      if (!product) return false;

      const productName = product.name ?? '';
      const barcode = product.barcode ?? '';
      const sku = product.sku ?? '';

      const matchesSearch =
        !searchQuery ||
        productName.toLowerCase().includes(searchLower) ||
        barcode.toLowerCase().includes(searchLower) ||
        sku.toLowerCase().includes(searchLower);

      const matchesCategory =
        !selectedCategory || product.category_id === selectedCategory;

      return matchesSearch && matchesCategory && product.stock > 0;
    });
  }, [products, debouncedSearch, selectedCategory]);

  // Calculate totals — memoized for performance
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.qty, 0),
    [cart]
  );
  const total = subtotal; // total === subtotal in this POS (no tax/discount)
  const cashValue = useMemo(() => parseFloat(cashReceived || '0'), [cashReceived]);
  const change = useMemo(() => (isNaN(cashValue) ? 0 : cashValue - total), [cashValue, total]);

  // Low stock count — memoized
  const lowStockCount = useMemo(() => {
    return products.filter((p) => {
      if (p.stock <= 0) return false;
      const threshold = p.low_stock_threshold ?? 10;
      return p.stock < threshold;
    }).length;
  }, [products]);

  // Total cart items — memoized
  const totalCartItems = useMemo(
    () => cart.reduce((sum, item) => sum + item.qty, 0),
    [cart]
  );

  // Barcode scanning - improved algorithm
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!scannerActive) return;

    // Ignore if typing in input or contenteditable
    const activeElement = document.activeElement;
    if (
      activeElement instanceof HTMLInputElement ||
      activeElement instanceof HTMLTextAreaElement ||
      activeElement?.getAttribute('contenteditable') === 'true'
    ) {
      return;
    }

    const now = Date.now();
    const timeDiff = now - lastKeyTimeRef.current;

    // Reset buffer if more than 50ms passed between keys (barcode scanners are fast)
    if (timeDiff > 50) {
      barcodeBufferRef.current = '';
    }

    lastKeyTimeRef.current = now;

    // Process the key
    if (e.key === 'Enter') {
      const buffer = barcodeBufferRef.current.trim();
      if (buffer.length >= 8 && buffer.length <= 100) {
        const barcode = buffer.toLowerCase();
        // Search product by barcode (case-insensitive)
        const product = products.find((p) => p.barcode?.toLowerCase() === barcode);

        if (product) {
          addToCart(product);
          // Visual feedback - flash the search input
          searchInputRef.current?.classList.add('ring-2', 'ring-teal-500');
          setTimeout(() => {
            searchInputRef.current?.classList.remove('ring-2', 'ring-teal-500');
          }, 200);
          // Clear search and refocus
          setSearchQuery('');
          searchInputRef.current?.focus();
        } else {
          setError(`Produk tidak ditemukan: ${barcode}`);
          setTimeout(() => setError(''), 3000);
        }
      }
      barcodeBufferRef.current = '';
      return;
    }

    // Only add printable characters to buffer — enforce max length
    if (e.key.length === 1 && barcodeBufferRef.current.length < 100) {
      barcodeBufferRef.current += e.key;
    } else if (barcodeBufferRef.current.length >= 100) {
      // Buffer overflow — reset to prevent memory issues
      barcodeBufferRef.current = '';
    }
  }, [products, scannerActive]);

  // Attach keyboard listener
  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // Add product to cart
  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product_id === product.id);
      if (existing) {
        // Check stock
        if (existing.qty >= product.stock) {
          setError('Stok tidak mencukupi');
          setTimeout(() => setError(''), 2000);
          return prev;
        }
        return prev.map((item) =>
          item.product_id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [
        ...prev,
        {
          product_id: product.id,
          product_name: product.name,
          price: Number(product.price),
          qty: 1,
          stock: product.stock,
          image_url: product.image_url,
        },
      ];
    });

    // Haptic feedback for mobile
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  }, []);

  // Update quantity
  const updateQty = useCallback((productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.qty + delta;
            if (newQty <= 0) return null;
            if (newQty > item.stock) {
              setError('Stok tidak mencukupi');
              setTimeout(() => setError(''), 2000);
              return item;
            }
            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter((item): item is LocalCartItem => item !== null);
    });
  }, []);

  // Remove from cart
  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.product_id !== productId));
  }, []);

  // Clear cart
  const clearCart = useCallback(() => {
    setCart([]);
    setShowPayment(false);
    localStorage.removeItem('pos_cart');
  }, []);

  // Quick cash amounts for mobile
  const quickCashAmounts = [10000, 20000, 50000, 100000];

  // Process payment — memoized to avoid recreation on every render
  const handlePayment = useCallback(async () => {
    // Client-side stock validation
    for (const item of cart) {
      const product = products.find((p) => p.id === item.product_id);
      if (!product || item.qty > product.stock) {
        toast.error(
          `Stok ${item.product_name} tidak mencukupi! Tersisa: ${product?.stock || 0}`
        );
        return;
      }
    }

    if (cart.length === 0) return;

    if (paymentMethod === 'cash' && change < 0) {
      setError('Uang pembayaran kurang');
      return;
    }

    if (paymentMethod === 'hutang' && !customerName.trim()) {
      setError('Nama pelanggan wajib diisi untuk kasbon/hutang');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Prepare items as JSONB
      const itemsJson = cart.map((item) => ({
        product_id: item.product_id,
        qty: item.qty,
        price: item.price,
      }));

      // Use atomic RPC function — debt recording is now atomic within the RPC for hutang
      const { data: transactionId, error: rpcError } = await supabase.rpc(
        'create_pos_transaction',
        {
          p_cashier_id: user.id,
          p_total: total,
          p_payment_method: paymentMethod,
          p_items: itemsJson,
          p_customer_name: paymentMethod === 'hutang' ? customerName.trim() : null,
        }
      );

      if (rpcError) {
        // Handle stock-related RPC errors
        if (
          rpcError.message?.includes('Insufficient stock') ||
          rpcError.message?.includes('stok') ||
          rpcError.message?.includes('Stok')
        ) {
          toast.error('Stok tidak mencukupi. Silakan kurangi jumlah di keranjang.');
          setLoading(false);
          return;
        }
        // Handle price manipulation
        if (rpcError.message?.includes('Harga') || rpcError.message?.includes('harga')) {
          toast.error('Harga produk berubah. Silakan refresh halaman.');
          setLoading(false);
          return;
        }
        console.error('RPC Error:', rpcError);
        throw new Error(rpcError.message);
      }

      if (!transactionId) {
        throw new Error('Gagal membuat transaksi');
      }

      // Get full transaction details with product info for receipt
      const { data: fullTransaction } = await supabase
        .from('transactions')
        .select(`
          *,
          cashier:profiles!cashier_id(full_name),
          items:transaction_items(
            *,
            product:products!product_id(name)
          )
        `)
        .eq('id', transactionId)
        .single();

      setLastTransaction(fullTransaction);
      setShowPayment(false);
      setShowReceipt(true);
      clearCart();
      // Only store cash info for cash payments
      if (paymentMethod === 'cash') {
        localStorage.setItem('last_cash_received', cashReceived);
      } else {
        localStorage.removeItem('last_cash_received');
      }
      setCustomerName('');
      refetchProducts(); // Refetch from DB so all tabs see updated stock

      // Update local products
      setProducts((prev) =>
        prev.map((p) => {
          const item = cart.find((i) => i.product_id === p.id);
          if (item) {
            return { ...p, stock: p.stock - item.qty };
          }
          return p;
        })
      );
    } catch (error) {
      console.error('Payment error:', error);
      setError('Gagal memproses pembayaran');
    } finally {
      setLoading(false);
    }
  }, [cart, products, total, change, paymentMethod, customerName, supabase, user.id, clearCart, refetchProducts]);

  // Low stock helper
  const isLowStock = (product: Product) =>
    (product.low_stock_threshold ? product.stock < product.low_stock_threshold : product.stock < 10);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Quick add cash
  const addCashAmount = (amount: number) => {
    setCashReceived((prev) => (parseFloat(prev || '0') + amount).toString());
  };

  return (
    <div className="flex h-screen w-full bg-background flex-row">
      {/* Main Content - Products */}
      <div className="print-hide" style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: '0', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 'var(--space-2) var(--space-3)',
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderBottom: '1px solid var(--color-outline-variant)',
          flexShrink: '0',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <img src="/logo-ras.png" alt="Logo" style={{ height: '2.5rem', width: 'auto', objectFit: 'contain' }} className="hidden sm:block" />
              <div>
                <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-title-lg)', fontWeight: '700', color: 'var(--color-on-surface)' }}>Kasir POS</h1>
                <span style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)' }} className="hidden sm:block">Warung Sembako by RAS</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <button
              onClick={() => setScannerActive(!scannerActive)}
              style={{
                padding: 'var(--space-2)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid',
                borderColor: scannerActive ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                backgroundColor: scannerActive ? 'var(--color-primary-fixed)' : 'var(--color-surface-container)',
                color: scannerActive ? 'var(--color-primary)' : 'var(--color-outline)',
                cursor: 'pointer',
                transition: 'all var(--transition-base)',
              }}
              title={scannerActive ? 'Barcode scanner ON' : 'Barcode scanner OFF'}
            >
              <QrCode style={{ width: '1.25rem', height: '1.25rem' }} />
            </button>
            <button
              onClick={() => setShowCart(true)}
              style={{
                position: 'relative',
                padding: 'var(--space-2)',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-on-primary)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                cursor: 'pointer',
                transition: 'transform var(--transition-fast)',
              }}
              onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.95)'; }}
              onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              <ShoppingCart style={{ width: '1.25rem', height: '1.25rem' }} />
              {cart.length > 0 && (
                <span style={{
                  position: 'absolute', top: '-0.25rem', right: '-0.25rem',
                  width: '1.25rem', height: '1.25rem',
                  backgroundColor: 'var(--color-secondary)', color: 'var(--color-on-secondary)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--text-label-sm)', fontWeight: '600',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Low Stock Banner */}
        {lowStockCount > 0 && (
          <div style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'var(--color-warning)',
            borderBottom: '1px solid var(--color-warning)',
            display: 'flex', alignItems: 'center', gap: 'var(--space-2)',
            flexShrink: '0',
          }}>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-secondary)' }}>
              {lowStockCount} produk stok menipis
            </span>
          </div>
        )}

        {/* Search & Categories */}
        <div style={{
          padding: 'var(--space-3)',
          backgroundColor: 'var(--color-surface-container-lowest)',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', flexDirection: 'column', gap: 'var(--space-2)',
          flexShrink: '0',
        }}>
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: 'var(--color-outline)' }} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari nama atau scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%', paddingLeft: '2.25rem', paddingRight: 'var(--space-4)',
                paddingTop: '0.625rem', paddingBottom: '0.625rem',
                fontSize: 'var(--text-body-sm)',
                border: '1.5px solid var(--color-outline-variant)',
                borderRadius: 'var(--radius-lg)',
                outline: 'none',
                backgroundColor: 'var(--color-surface-container-high)',
                color: 'var(--color-on-surface)',
                fontFamily: 'var(--font-body)',
                transition: 'border-color var(--transition-base)',
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-primary)';
                e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                e.currentTarget.style.backgroundColor = 'var(--color-surface-container-high)';
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)',
                  padding: 'var(--space-1)',
                  color: 'var(--color-outline)', cursor: 'pointer',
                  backgroundColor: 'transparent', border: 'none',
                }}
              >
                <X style={{ width: '1rem', height: '1rem' }} />
              </button>
            )}
          </div>
          {/* Category Pills */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', overflowX: 'auto', paddingBottom: 'var(--space-1)' }} className="-mx-1 px-1 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('')}
              style={{
                padding: 'var(--space-1) var(--space-3)',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '600',
                border: 'none', cursor: 'pointer',
                backgroundColor: !selectedCategory ? 'var(--color-primary)' : 'var(--color-surface-container)',
                color: !selectedCategory ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                transition: 'all var(--transition-base)',
                whiteSpace: 'nowrap',
              }}
            >
              Semua
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: 'var(--space-1) var(--space-3)',
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '600',
                  border: 'none', cursor: 'pointer',
                  backgroundColor: selectedCategory === cat.id ? 'var(--color-primary)' : 'var(--color-surface-container)',
                  color: selectedCategory === cat.id ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)',
                  transition: 'all var(--transition-base)',
                  whiteSpace: 'nowrap',
                }}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div style={{
            margin: 'var(--space-2) var(--space-3)',
            padding: 'var(--space-2)',
            backgroundColor: 'var(--color-error-container)',
            border: '1px solid var(--color-error)',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--color-error)',
            fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)',
            flexShrink: '0',
          }}>
            {error}
          </div>
        )}

        {/* Products Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-3)' }}>
          <div style={{ gap: 'var(--space-2)' }} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                style={{
                  backgroundColor: 'var(--color-surface-container-lowest)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--color-outline-variant)',
                  padding: 'var(--space-2)',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all var(--transition-base)',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-outline-variant)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'scale(0.97)';
                  e.currentTarget.style.backgroundColor = 'var(--color-primary-fixed)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.backgroundColor = 'var(--color-surface-container-lowest)';
                }}
              >
                <div style={{ aspectRatio: '1', width: '100%', backgroundColor: 'var(--color-surface-dim)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-2)', overflow: 'hidden', position: 'relative', flexShrink: '0' }}>
                  {product.image_url ? (
                    <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Package style={{ width: '1.5rem', height: '1.5rem', color: 'var(--color-outline-variant)' }} />
                    </div>
                  )}
                  {isLowStock(product) && (
                    <span style={{
                      position: 'absolute', top: 'var(--space-1)', left: 'var(--space-1)',
                      padding: '2px 6px',
                      backgroundColor: 'var(--color-warning)', color: 'var(--color-on-secondary)',
                      fontSize: '10px', fontWeight: '600', borderRadius: 'var(--radius-full)',
                      fontFamily: 'var(--font-label)',
                    }}>
                      {product.stock} stok
                    </span>
                  )}
                </div>
                <h3 style={{
                  fontFamily: 'var(--font-body)', fontWeight: '600', fontSize: 'var(--text-body-sm)',
                  color: 'var(--color-on-surface)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  lineHeight: 'var(--leading-tight)',
                }}>
                  {product.name}
                </h3>
                <p style={{
                  fontFamily: 'var(--font-body)', fontWeight: '700', fontSize: 'var(--text-body-md)',
                  color: 'var(--color-primary)', marginTop: 'var(--space-1)',
                }}>
                  {formatCurrency(product.price)}
                </p>
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div style={{ textAlign: 'center', paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
              <Package style={{ width: '2.5rem', height: '2.5rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-2)' }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)', color: 'var(--color-outline)' }}>Produk tidak ditemukan</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar - Desktop Only */}
      <div style={{
        width: '20rem',
        backgroundColor: 'var(--color-surface-container-lowest)',
        borderLeft: '1px solid var(--color-outline-variant)',
        flexDirection: 'column',
        flexShrink: '0',
      }} className="hidden lg:flex print-hide">
        <div style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--color-outline-variant)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
            Keranjang ({cart.length})
          </h2>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-1)',
                fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)',
                color: 'var(--color-outline)', cursor: 'pointer',
                backgroundColor: 'transparent', border: 'none',
              }}
            >
              <RotateCcw style={{ width: '0.75rem', height: '0.75rem' }} />
              Kosongkan
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', paddingTop: 'var(--space-8)' }}>
              <ShoppingCart style={{ width: '2.5rem', height: '2.5rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-2)' }} />
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-md)', color: 'var(--color-outline)' }}>Keranjang kosong</p>
              <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-1)' }}>Klik produk untuk menambah</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.product_id} style={{ backgroundColor: 'var(--color-surface-container)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-2)' }}>
                  <div style={{ flex: 1, minWidth: '0' }}>
                    <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: '500', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.product_name}
                    </h3>
                    <p style={{ fontFamily: 'var(--font-body)', fontWeight: '600', fontSize: 'var(--text-body-sm)', color: 'var(--color-primary)' }}>
                      {formatCurrency(item.price)}
                    </p>
                  </div>
                  <button onClick={() => removeFromCart(item.product_id)} style={{ padding: 'var(--space-1)', color: 'var(--color-outline)', cursor: 'pointer', backgroundColor: 'transparent', border: 'none', flexShrink: '0' }}>
                    <Trash2 style={{ width: '1rem', height: '1rem' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                    <button
                      onClick={() => updateQty(item.product_id, -1)}
                      style={{
                        width: '1.75rem', height: '1.75rem',
                        backgroundColor: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
                        borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--color-on-surface-variant)',
                      }}
                    >
                      <Minus style={{ width: '0.75rem', height: '0.75rem' }} />
                    </button>
                    <span style={{ width: '1.5rem', textAlign: 'center', fontFamily: 'var(--font-body)', fontWeight: '600', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)' }}>
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.product_id, 1)}
                      disabled={item.qty >= item.stock}
                      style={{
                        width: '1.75rem', height: '1.75rem',
                        backgroundColor: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
                        borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: item.qty >= item.stock ? 'not-allowed' : 'pointer',
                        color: 'var(--color-on-surface-variant)',
                        opacity: item.qty >= item.stock ? '0.5' : '1',
                      }}
                    >
                      <Plus style={{ width: '0.75rem', height: '0.75rem' }} />
                    </button>
                  </div>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)' }}>
                    {formatCurrency(item.price * item.qty)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: 'var(--text-title-md)', color: 'var(--color-on-surface)' }}>Total</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: 'var(--text-title-md)', color: 'var(--color-primary)' }}>{formatCurrency(total)}</span>
            </div>
            <button
              onClick={() => setShowPayment(true)}
              style={{
                width: '100%', paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)',
                backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)',
                border: 'none', borderRadius: 'var(--radius-lg)',
                fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: 'var(--text-body-md)',
                cursor: 'pointer',
                transition: 'background-color var(--transition-base)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary-container)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-primary)'; }}
            >
              Bayar
            </button>
          </div>
        )}
      </div>

      {/* Cart Drawer - Mobile */}
      {showCart && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-overlay)' }} className="lg:hidden">
          <div style={{
            position: 'absolute', right: '0', top: '0', height: '100%', width: '100%', maxWidth: '28rem',
            backgroundColor: 'var(--color-surface-container-lowest)',
            display: 'flex', flexDirection: 'column',
            animation: 'slideInRight 200ms ease',
          }}>
            <div style={{
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--color-outline-variant)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              flexShrink: '0',
            }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: 'var(--text-title-lg)', color: 'var(--color-on-surface)' }}>
                Keranjang ({totalCartItems})
              </h2>
              <button
                onClick={() => setShowCart(false)}
                style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', backgroundColor: 'transparent', border: 'none', color: 'var(--color-on-surface-variant)' }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {cart.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 'var(--space-12)' }}>
                  <ShoppingCart style={{ width: '3rem', height: '3rem', color: 'var(--color-outline-variant)', margin: '0 auto var(--space-3)' }} />
                  <p style={{ fontFamily: 'var(--font-body)', color: 'var(--color-outline)' }}>Keranjang kosong</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.product_id} style={{ backgroundColor: 'var(--color-surface-container)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-3)' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ flex: 1, minWidth: '0' }}>
                        <h3 style={{ fontFamily: 'var(--font-body)', fontWeight: '600', fontSize: 'var(--text-body-sm)', color: 'var(--color-on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.product_name}
                        </h3>
                        <p style={{ fontFamily: 'var(--font-body)', fontWeight: '600', fontSize: 'var(--text-body-sm)', color: 'var(--color-primary)' }}>
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      <button onClick={() => removeFromCart(item.product_id)} style={{ padding: 'var(--space-2)', color: 'var(--color-outline)', cursor: 'pointer', backgroundColor: 'transparent', border: 'none', flexShrink: '0' }}>
                        <Trash2 style={{ width: '1rem', height: '1rem' }} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'var(--space-2)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <button
                          onClick={() => updateQty(item.product_id, -1)}
                          style={{
                            width: '2.25rem', height: '2.25rem',
                            backgroundColor: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
                            borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Minus style={{ width: '1rem', height: '1rem' }} />
                        </button>
                        <span style={{ width: '2rem', textAlign: 'center', fontFamily: 'var(--font-body)', fontWeight: '600', color: 'var(--color-on-surface)' }}>
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.product_id, 1)}
                          disabled={item.qty >= item.stock}
                          style={{
                            width: '2.25rem', height: '2.25rem',
                            backgroundColor: 'var(--color-surface-container-lowest)', border: '1px solid var(--color-outline-variant)',
                            borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: item.qty >= item.stock ? 'not-allowed' : 'pointer',
                            opacity: item.qty >= item.stock ? '0.5' : '1',
                          }}
                        >
                          <Plus style={{ width: '1rem', height: '1rem' }} />
                        </button>
                      </div>
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', color: 'var(--color-on-surface)' }}>
                        {formatCurrency(item.price * item.qty)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', flexShrink: '0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: 'var(--text-title-lg)', color: 'var(--color-on-surface)' }}>Total</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: '700', fontSize: 'var(--text-title-lg)', color: 'var(--color-primary)' }}>{formatCurrency(total)}</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button
                    onClick={clearCart}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1px solid var(--color-outline-variant)', color: 'var(--color-on-surface-variant)',
                      borderRadius: 'var(--radius-lg)',
                      fontFamily: 'var(--font-body)', fontWeight: '500',
                      cursor: 'pointer', backgroundColor: 'transparent',
                    }}
                  >
                    Kosongkan
                  </button>
                  <button
                    onClick={() => { setShowCart(false); setShowPayment(true); }}
                    style={{
                      flex: 1,
                      padding: 'var(--space-3)',
                      backgroundColor: 'var(--color-primary)', color: 'var(--color-on-primary)',
                      border: 'none', borderRadius: 'var(--radius-lg)',
                      fontFamily: 'var(--font-heading)', fontWeight: '600',
                      cursor: 'pointer',
                    }}
                  >
                    Bayar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} className="sm:items-center">
          <div style={{
            backgroundColor: 'var(--color-surface-container-lowest)',
            borderRadius: paymentMethod === 'cash' ? 'var(--radius-xl) var(--radius-xl) 0 0' : 'var(--radius-xl)',
            width: '100%', maxWidth: '28rem',
            maxHeight: '90dvh', overflowY: 'auto',
            animation: 'slideInUp 200ms ease',
          }} className="sm:rounded-xl">
            <div style={{
              padding: 'var(--space-4)',
              borderBottom: '1px solid var(--color-outline-variant)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              position: 'sticky', top: '0',
              backgroundColor: 'var(--color-surface-container-lowest)',
            }}>
              <h2 style={{ fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: 'var(--text-title-lg)', color: 'var(--color-on-surface)' }}>Pembayaran</h2>
              <button
                onClick={() => setShowPayment(false)}
                style={{ padding: 'var(--space-2)', borderRadius: 'var(--radius-lg)', cursor: 'pointer', backgroundColor: 'transparent', border: 'none', color: 'var(--color-on-surface-variant)' }}
              >
                <X style={{ width: '1.25rem', height: '1.25rem' }} />
              </button>
            </div>

            <div style={{ padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              {/* Total */}
              <div style={{ textAlign: 'center', padding: 'var(--space-3)', backgroundColor: 'var(--color-surface-container)', borderRadius: 'var(--radius-lg)' }}>
                <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-body-sm)', color: 'var(--color-outline)' }}>Total Tagihan</p>
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: 'var(--text-display-sm)', color: 'var(--color-primary)', letterSpacing: 'var(--tracking-tight)' }}>
                  {formatCurrency(total)}
                </p>
              </div>

              {/* Payment Method */}
              <div>
                <label style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', marginBottom: 'var(--space-2)', display: 'block' }}>
                  Metode Pembayaran
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)' }}>
                  {[
                    { key: 'cash', label: 'Tunai', Icon: Banknote },
                    { key: 'qris', label: 'QRIS', Icon: QrCode },
                    { key: 'transfer', label: 'Transfer', Icon: CreditCard },
                  ].map(({ key, label, Icon }) => {
                    const isActive = paymentMethod === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setPaymentMethod(key as typeof paymentMethod)}
                        style={{
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--radius-lg)',
                          border: '1.5px solid',
                          borderColor: isActive ? 'var(--color-primary)' : 'var(--color-outline-variant)',
                          backgroundColor: isActive ? 'var(--color-primary-fixed)' : 'transparent',
                          color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-2)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-base)',
                        }}
                        onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.97)'; }}
                        onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
                      >
                        <Icon style={{ width: '1.5rem', height: '1.5rem' }} />
                        <span style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '600' }}>{label}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Hutang button - full width */}
                <button
                  onClick={() => { setPaymentMethod('hutang'); setCashReceived(''); }}
                  style={{
                    marginTop: 'var(--space-2)',
                    width: '100%',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-lg)',
                    border: '1.5px solid',
                    borderColor: paymentMethod === 'hutang' ? 'var(--color-secondary)' : 'var(--color-outline-variant)',
                    backgroundColor: paymentMethod === 'hutang' ? 'var(--color-secondary-fixed)' : 'transparent',
                    color: paymentMethod === 'hutang' ? 'var(--color-secondary)' : 'var(--color-on-surface-variant)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: 'pointer',
                    transition: 'all var(--transition-base)',
                    fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '600',
                  }}
                >
                  <BookUser style={{ width: '1.5rem', height: '1.5rem' }} />
                  Kasbon / Hutang
                </button>
              </div>

              {/* Customer Name (only for hutang) */}
              {paymentMethod === 'hutang' && (
                <div>
                  <label style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <BookUser style={{ width: '1rem', height: '1rem' }} />
                    Nama Pelanggan (Pengutang) *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      fontSize: 'var(--text-body-md)',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-body)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-secondary)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
                    placeholder="Masukkan nama pelanggan"
                    required
                  />
                  <p style={{ fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', color: 'var(--color-outline)', marginTop: 'var(--space-2)' }}>
                    Transaksi ini akan tercatat di Buku Utang secara otomatis.
                  </p>
                </div>
              )}

              {/* Cash Received (only for cash) */}
              {paymentMethod === 'cash' && (
                <div>
                  <label style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-sm)', fontWeight: '500', color: 'var(--color-on-surface-variant)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                    <Calculator style={{ width: '1rem', height: '1rem' }} />
                    Uang Diterima
                  </label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    style={{
                      width: '100%',
                      padding: 'var(--space-3) var(--space-4)',
                      border: '1.5px solid var(--color-outline-variant)',
                      borderRadius: 'var(--radius-lg)',
                      outline: 'none',
                      fontSize: 'var(--text-title-md)',
                      backgroundColor: 'var(--color-surface-container-high)',
                      color: 'var(--color-on-surface)',
                      fontFamily: 'var(--font-heading)',
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--color-outline-variant)'; }}
                    placeholder="Masukkan nominal"
                    inputMode="numeric"
                  />
                  {/* Quick Amount Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {quickCashAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setCashReceived(amount.toString())}
                        style={{
                          padding: 'var(--space-2)',
                          backgroundColor: 'var(--color-surface-container)',
                          color: 'var(--color-on-surface-variant)',
                          borderRadius: 'var(--radius-lg)',
                          fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '600',
                          border: 'none', cursor: 'pointer',
                          transition: 'background-color var(--transition-fast)',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-dim)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-surface-container)'; }}
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>
                  {/* Additional quick actions */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    {[
                      { label: 'Uang Pas', action: () => setCashReceived(total.toString()) },
                      { label: '+10Ribu', action: () => addCashAmount(10000) },
                      { label: '+50Ribu', action: () => addCashAmount(50000) },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        onClick={btn.action}
                        style={{
                          padding: 'var(--space-2)',
                          backgroundColor: 'var(--color-primary-fixed)',
                          color: 'var(--color-primary)',
                          borderRadius: 'var(--radius-lg)',
                          fontFamily: 'var(--font-label)', fontSize: 'var(--text-label-sm)', fontWeight: '600',
                          border: 'none', cursor: 'pointer',
                        }}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  {change >= 0 && cashReceived && (
                    <p style={{
                      marginTop: 'var(--space-3)',
                      textAlign: 'center',
                      padding: 'var(--space-2)',
                      backgroundColor: 'var(--color-success-container)',
                      color: 'var(--color-success)',
                      borderRadius: 'var(--radius-lg)',
                      fontFamily: 'var(--font-heading)', fontWeight: '700',
                    }}>
                      Kembalian: {formatCurrency(change)}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={loading || (paymentMethod === 'cash' && change < 0) || (paymentMethod === 'hutang' && !customerName.trim())}
                style={{
                  width: '100%',
                  paddingTop: 'var(--space-3)', paddingBottom: 'var(--space-3)',
                  backgroundColor: loading || (paymentMethod === 'cash' && change < 0) || (paymentMethod === 'hutang' && !customerName.trim())
                    ? 'var(--color-surface-container)'
                    : 'var(--color-primary)',
                  color: loading || (paymentMethod === 'cash' && change < 0) || (paymentMethod === 'hutang' && !customerName.trim())
                    ? 'var(--color-outline)'
                    : 'var(--color-on-primary)',
                  border: 'none', borderRadius: 'var(--radius-lg)',
                  fontFamily: 'var(--font-heading)', fontWeight: '600', fontSize: 'var(--text-body-md)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                  cursor: (loading || (paymentMethod === 'cash' && change < 0) || (paymentMethod === 'hutang' && !customerName.trim())) ? 'not-allowed' : 'pointer',
                  transition: 'background-color var(--transition-base)',
                }}
              >
                {loading ? (
                  <>
                    <div style={{ width: '1.25rem', height: '1.25rem', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Memproses...
                  </>
                ) : (
                  'Selesaikan Pembayaran'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal with Thermal Receipt */}
      {showReceipt && lastTransaction && (
        <>
          {/* Print-only thermal receipt (hidden on screen) */}
          <div className="print-receipt">
            <ThermalReceipt
              transaction={lastTransaction}
              cashReceived={
                lastTransaction.payment_method === 'cash'
                  ? parseFloat(cashReceived || localStorage.getItem('last_cash_received') || '0')
                  : 0
              }
              change={
                lastTransaction.payment_method === 'cash'
                  ? parseFloat(cashReceived || localStorage.getItem('last_cash_received') || '0') - lastTransaction.total
                  : 0
              }
            />
          </div>

          {/* Visual Receipt Modal */}
          <div style={{ position: 'fixed', inset: '0', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 'var(--z-modal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
            <div style={{
              backgroundColor: 'var(--color-surface-container-lowest)',
              borderRadius: 'var(--radius-xl)',
              width: '100%', maxWidth: '24rem',
              maxHeight: '90dvh', overflowY: 'auto',
            }}>
              {/* Receipt Display - scaled for screen */}
              <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--color-outline-variant)' }}>
                <ThermalReceipt
                  transaction={lastTransaction}
                  cashReceived={
                    lastTransaction.payment_method === 'cash'
                      ? parseFloat(cashReceived || localStorage.getItem('last_cash_received') || '0')
                      : 0
                  }
                  change={
                    lastTransaction.payment_method === 'cash'
                      ? parseFloat(cashReceived || localStorage.getItem('last_cash_received') || '0') - lastTransaction.total
                      : 0
                  }
                />
              </div>

              {/* Actions */}
              <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--color-outline-variant)', display: 'flex', gap: 'var(--space-3)' }}>
                <button
                  onClick={() => {
                    setShowReceipt(false);
                    setCashReceived('');
                    localStorage.removeItem('last_cash_received');
                  }}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3)',
                    border: '1px solid var(--color-outline-variant)',
                    color: 'var(--color-on-surface-variant)',
                    backgroundColor: 'transparent',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-body)', fontWeight: '500',
                    cursor: 'pointer',
                  }}
                >
                  Tutup
                </button>
                <button
                  onClick={() => window.print()}
                  style={{
                    flex: 1,
                    padding: 'var(--space-3)',
                    backgroundColor: 'var(--color-primary)',
                    color: 'var(--color-on-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontFamily: 'var(--font-body)', fontWeight: '600',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-2)',
                    cursor: 'pointer',
                  }}
                >
                  <Printer style={{ width: '1.25rem', height: '1.25rem' }} />
                  Cetak
                </button>
              </div>
            </div>
          </div>

          {/* Print-only styles */}
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            @keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
            @keyframes slideInUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
            @media print {
              @page {
                size: 58mm auto;
                margin: 0;
              }
              body {
                background: white;
                margin: 0;
                padding: 0;
              }
              .print-hide {
                display: none !important;
              }
              .print-receipt {
                display: block !important;
                width: 58mm;
                margin: 0 auto;
                padding: 0;
              }
            }
            .print-receipt {
              display: none;
            }
          `}</style>
        </>
      )}
    </div>
  );
}
