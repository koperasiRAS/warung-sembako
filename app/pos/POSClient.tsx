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

  // Load cart from localStorage on mount
  useEffect(() => {
    const savedCart = localStorage.getItem('pos_cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (e) {
        console.error('Failed to load cart:', e);
      }
    }
  }, []);

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

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const total = subtotal;
  const cashValue = parseFloat(cashReceived || '0');
  const change = isNaN(cashValue) ? 0 : cashValue - total;

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
      if (barcodeBufferRef.current.length >= 8) {
        const barcode = barcodeBufferRef.current.trim().toLowerCase();
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

    // Only add printable characters to buffer
    if (e.key.length === 1) {
      barcodeBufferRef.current += e.key;
    }
  }, [products, scannerActive, setSearchQuery]);

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

  // Process payment - using atomic RPC for transaction integrity
  const handlePayment = async () => {
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

      // Use atomic RPC function for transaction integrity
      const { data: transactionId, error: rpcError } = await supabase.rpc(
        'create_pos_transaction',
        {
          p_cashier_id: user.id,
          p_total: total,
          p_payment_method: paymentMethod,
          p_items: itemsJson,
        }
      );

      if (rpcError) {
        // Handle stock-related RPC errors
        if (
          rpcError.message?.includes('Insufficient stock') ||
          rpcError.message?.includes('stock')
        ) {
          toast.error('Stok tidak mencukupi. Silakan kurangi jumlah di keranjang.');
          setLoading(false);
          return;
        }
        console.error('RPC Error:', rpcError);
        throw new Error(rpcError.message);
      }

      if (!transactionId) {
        throw new Error('Gagal membuat transaksi');
      }

      // If debt (hutang), insert into debts table
      if (paymentMethod === 'hutang') {
        const { error: debtError } = await supabase.from('debts').insert({
          transaction_id: transactionId,
          customer_name: customerName,
          amount: total,
          remaining_amount: total,
          status: 'unpaid'
        });
        
        if (debtError) {
          console.error('Failed to record debt:', debtError);
          // Don't throw to not break the POS flow, but maybe show an alert
          toast.error('Transaksi berhasil tapi gagal mencatat ke Buku Utang!');
        }
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
      localStorage.setItem('last_cash_received', cashReceived);
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
  };

  // Low stock helper
  const isLowStock = (product: Product) =>
    (product.low_stock_threshold ? product.stock < product.low_stock_threshold : product.stock < 10);

  // Count low stock products (excluding out-of-stock)
  const lowStockCount = products.filter(p => p.stock > 0 && isLowStock(p)).length;
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
    <div className="h-screen flex flex-col bg-slate-50 lg:flex-row">
      {/* Main Content - Products */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img src="/logo-ras.png" alt="Logo" className="h-10 w-auto object-contain hidden sm:block" />
              <div>
                <h1 className="text-lg font-bold text-slate-800">Kasir POS</h1>
                <span className="text-xs text-slate-500 hidden sm:block">Warung Sembako by RAS</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScannerActive(!scannerActive)}
              className={`p-2 rounded-lg border ${
                scannerActive
                  ? 'bg-teal-50 border-teal-300 text-teal-600'
                  : 'bg-slate-50 border-slate-200 text-slate-400'
              }`}
              title={scannerActive ? 'Barcode scanner ON' : 'Barcode scanner OFF'}
            >
              <QrCode className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowCart(true)}
              className="relative p-2 bg-teal-600 text-white rounded-lg active:scale-95 transition-transform"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-500 rounded-full text-xs flex items-center justify-center font-medium">
                  {cart.reduce((sum, item) => sum + item.qty, 0)}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Low Stock Banner */}
        {lowStockCount > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-3 py-2 flex items-center gap-2 shrink-0">
            <span className="text-amber-600 text-sm font-medium">
              ⚠️ {lowStockCount} produk stok menipis
            </span>
          </div>
        )}

        {/* Search & Categories - Mobile Optimized */}
        <div className="bg-white border-b border-slate-200 p-3 space-y-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Cari nama atau scan barcode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {/* Category Pills - Horizontal scroll */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                !selectedCategory
                  ? 'bg-teal-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                  selectedCategory === cat.id
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-3 mt-2 p-2 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm shrink-0">
            {error}
          </div>
        )}

        {/* Products Grid - Touch Optimized */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white rounded-lg border border-slate-200 p-2 text-left hover:border-teal-400 hover:shadow-sm transition active:scale-95 active:bg-teal-50 relative"
              >
                <div className="aspect-square bg-slate-100 rounded-md mb-2 overflow-hidden">
                  {product.image_url ? (
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                  {isLowStock(product) && (
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded">
                      ⚠ {product.stock} stok
                    </span>
                  )}
                </div>
                <h3 className="font-medium text-slate-800 text-xs truncate leading-tight">
                  {product.name}
                </h3>
                <p className="text-teal-600 font-bold text-sm mt-0.5">
                  {formatCurrency(product.price)}
                </p>
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Produk tidak ditemukan</p>
            </div>
          )}
        </div>
      </div>

      {/* Cart Sidebar - Desktop Only */}
      <div className="hidden lg:flex w-80 bg-white border-l border-slate-200 flex-col shrink-0">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Keranjang ({cart.length})</h2>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-slate-500 hover:text-red-600 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              Kosongkan
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-8">
              <ShoppingCart className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-500 text-sm">Keranjang kosong</p>
              <p className="text-xs text-slate-400">Klik produk untuk menambah</p>
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.product_id}
                className="bg-slate-50 rounded-lg p-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-slate-800 text-sm truncate">
                      {item.product_name}
                    </h3>
                    <p className="text-xs text-teal-600">
                      {formatCurrency(item.price)}
                    </p>
                  </div>
                  <button
                    onClick={() => removeFromCart(item.product_id)}
                    className="p-1 text-slate-400 hover:text-red-500 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateQty(item.product_id, -1)}
                      className="w-7 h-7 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-600 active:bg-slate-100"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-6 text-center text-sm font-medium">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.product_id, 1)}
                      disabled={item.qty >= item.stock}
                      className="w-7 h-7 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-600 active:bg-slate-100 disabled:opacity-50"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <span className="font-semibold text-slate-800 text-sm">
                    {formatCurrency(item.price * item.qty)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {cart.length > 0 && (
          <div className="p-4 border-t border-slate-200 space-y-3">
            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span className="text-teal-600">{formatCurrency(total)}</span>
            </div>
            <button
              onClick={() => setShowPayment(true)}
              className="w-full py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 active:bg-teal-800 transition"
            >
              Bayar
            </button>
          </div>
        )}
      </div>

      {/* Cart Drawer - Mobile */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 lg:hidden">
          <div className="absolute right-0 top-0 h-full w-full max-w-sm bg-white flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-semibold text-slate-800">
                Keranjang ({cart.reduce((sum, item) => sum + item.qty, 0)})
              </h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-500">Keranjang kosong</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product_id}
                    className="bg-slate-50 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-800 text-sm truncate">
                          {item.product_name}
                        </h3>
                        <p className="text-sm text-teal-600">
                          {formatCurrency(item.price)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product_id)}
                        className="p-1.5 text-slate-400 hover:text-red-500 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.product_id, -1)}
                          className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center active:bg-slate-100"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.product_id, 1)}
                          disabled={item.qty >= item.stock}
                          className="w-9 h-9 bg-white border border-slate-200 rounded-lg flex items-center justify-center active:bg-slate-100 disabled:opacity-50"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(item.price * item.qty)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-200 space-y-3 shrink-0">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span className="text-teal-600">{formatCurrency(total)}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={clearCart}
                    className="px-4 py-3 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 active:bg-slate-100"
                  >
                    Kosongkan
                  </button>
                  <button
                    onClick={() => {
                      setShowCart(false);
                      setShowPayment(true);
                    }}
                    className="flex-1 py-3 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 active:bg-teal-800 transition"
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center">
          <div className="bg-white rounded-t-2xl sm:rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-slate-800">Pembayaran</h2>
              <button
                onClick={() => setShowPayment(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Total */}
              <div className="text-center py-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Total Tagihan</p>
                <p className="text-3xl font-bold text-teal-600">
                  {formatCurrency(total)}
                </p>
              </div>

              {/* Payment Method */}
              <div className="spacey-2">
                <label className="text-sm font-medium text-slate-700">
                  Metode Pembayaran
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 border rounded-lg flex flex-col items-center gap-1.5 transition active:scale-95 ${
                      paymentMethod === 'cash'
                        ? 'border-teal-600 bg-teal-50 text-teal-600'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-6 h-6" />
                    <span className="text-sm font-medium">Tunai</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('qris')}
                    className={`p-3 border rounded-lg flex flex-col items-center gap-1.5 transition active:scale-95 ${
                      paymentMethod === 'qris'
                        ? 'border-teal-600 bg-teal-50 text-teal-600'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <QrCode className="w-6 h-6" />
                    <span className="text-sm font-medium">QRIS</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('transfer')}
                    className={`p-3 border rounded-lg flex flex-col items-center gap-1.5 transition active:scale-95 ${
                      paymentMethod === 'transfer'
                        ? 'border-teal-600 bg-teal-50 text-teal-600'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="text-sm font-medium">Transfer</span>
                  </button>
                  <button
                    onClick={() => {
                      setPaymentMethod('hutang');
                      setCashReceived('');
                    }}
                    className={`p-3 border rounded-lg flex flex-col items-center gap-1.5 transition active:scale-95 ${
                      paymentMethod === 'hutang'
                        ? 'border-orange-600 bg-orange-50 text-orange-600'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <BookUser className="w-6 h-6" />
                    <span className="text-sm font-medium">Hutang</span>
                  </button>
                </div>
              </div>

              {/* Customer Name (only for hutang) */}
              {paymentMethod === 'hutang' && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <BookUser className="w-4 h-4" />
                    Nama Pelanggan (Pengutang) *
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500/20 focus:border-orange-600 outline-none"
                    placeholder="Masukkan nama pelanggan"
                    required
                  />
                  <p className="text-xs text-slate-500 mt-1.5">
                    Transaksi ini akan tercatat di Buku Utang secara otomatis.
                  </p>
                </div>
              )}

              {/* Cash Received (only for cash) */}
              {paymentMethod === 'cash' && (
                <div>
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Uang Diterima
                  </label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 outline-none text-lg"
                    placeholder="Masukkan nominal"
                    inputMode="numeric"
                  />
                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {quickCashAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setCashReceived(amount.toString())}
                        className="py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 active:bg-slate-300"
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>
                  {/* Additional quick actions */}
                  <div className="grid grid-cols-3 gap-2 mt-2">
                    {[
                      { label: 'Uang Pas', action: () => setCashReceived(total.toString()) },
                      { label: '+10Ribu', action: () => addCashAmount(10000) },
                      { label: '+50Ribu', action: () => addCashAmount(50000) },
                    ].map((btn) => (
                      <button
                        key={btn.label}
                        onClick={btn.action}
                        className="py-2 bg-teal-50 text-teal-700 rounded-lg text-sm font-medium hover:bg-teal-100 active:bg-teal-200"
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                  {change >= 0 && cashReceived && (
                    <p className="mt-3 text-green-600 font-semibold text-center bg-green-50 py-2 rounded-lg">
                      Kembalian: {formatCurrency(change)}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={loading || (paymentMethod === 'cash' && change < 0) || (paymentMethod === 'hutang' && !customerName.trim())}
                className="w-full py-3.5 bg-teal-600 text-white rounded-lg font-semibold hover:bg-teal-700 active:bg-teal-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
              cashReceived={parseFloat(cashReceived || localStorage.getItem('last_cash_received') || '0')}
              change={parseFloat(cashReceived || localStorage.getItem('last_cash_received') || '0') - lastTransaction.total}
            />
          </div>

          {/* Visual Receipt Modal */}
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-xl w-full max-w-sm max-h-[90vh] overflow-y-auto">
              {/* Receipt Display - scaled for screen */}
              <div className="p-4 border-b border-slate-200 scale-75 origin-top">
                <ThermalReceipt
                  transaction={lastTransaction}
                  cashReceived={parseFloat(cashReceived || localStorage.getItem('last_cash_received') || '0')}
                  change={parseFloat(cashReceived || localStorage.getItem('last_cash_received') || '0') - lastTransaction.total}
                />
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-slate-200 flex gap-3">
                <button
                  onClick={() => {
                    setShowReceipt(false);
                    setCashReceived('');
                    localStorage.removeItem('last_cash_received');
                  }}
                  className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 active:bg-slate-100 transition"
                >
                  Tutup
                </button>
                <button
                  onClick={() => window.print()}
                  className="flex-1 py-3 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 active:bg-teal-800 transition flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" />
                  Cetak
                </button>
              </div>
            </div>
          </div>

          {/* Print-only styles */}
          <style>{`
            @media print {
              @page {
                size: 58mm auto;
                margin: 0;
              }
              body * {
                visibility: hidden;
              }
              .print-receipt {
                display: block !important;
                position: absolute;
                top: 0;
                left: 0;
                width: 58mm;
                visibility: visible;
              }
              .print-receipt * {
                visibility: visible;
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