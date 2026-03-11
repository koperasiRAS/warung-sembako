'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Product, Category, CartItem } from '@/lib/supabase/types';
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
} from 'lucide-react';

interface POSClientProps {
  initialProducts: Product[];
  initialCategories: Category[];
  user: { id: string; email: string };
}

export default function POSClient({
  initialProducts,
  initialCategories,
  user,
}: POSClientProps) {
  const supabase = createClient();
  const [products, setProducts] = useState(initialProducts);
  const [categories] = useState(initialCategories);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showCart, setShowCart] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qris' | 'transfer'>('cash');
  const [cashReceived, setCashReceived] = useState('');
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimeoutRef = useRef<NodeJS.Timeout>();

  // Filter products
  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      !selectedCategory || product.category_id === selectedCategory;
    return matchesSearch && matchesCategory && product.stock > 0;
  });

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const total = subtotal;
  const change = parseFloat(cashReceived || '0') - total;

  // Barcode scanning handler
  const handleBarcodeInput = useCallback((char: string) => {
    setBarcodeBuffer((prev) => {
      const newBuffer = prev + char;

      // Clear timeout
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }

      // Set timeout to process barcode
      barcodeTimeoutRef.current = setTimeout(() => {
        if (newBuffer.length >= 8) {
          // Search product by barcode
          const product = products.find(
            (p) => p.barcode === newBuffer
          );
          if (product) {
            addToCart(product);
          } else {
            setError('Product not found');
            setTimeout(() => setError(''), 2000);
          }
        }
        setBarcodeBuffer('');
      }, 100);

      return newBuffer;
    });
  }, [products]);

  // Listen for keyboard input (barcode scanner)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ignore if typing in input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Only accept digits
      if (/^\d$/.test(e.key)) {
        handleBarcodeInput(e.key);
      }
    };

    window.addEventListener('keypress', handleKeyPress);
    return () => {
      window.removeEventListener('keypress', handleKeyPress);
      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current);
      }
    };
  }, [handleBarcodeInput]);

  // Add product to cart
  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, qty: item.qty + 1 }
            : item
        );
      }
      return [...prev, { product, qty: 1 }];
    });
  };

  // Update quantity
  const updateQty = (productId: string, delta: number) => {
    setCart((prev) => {
      return prev
        .map((item) => {
          if (item.product.id === productId) {
            const newQty = item.qty + delta;
            if (newQty <= 0) return null;
            if (newQty > item.product.stock) {
              setError('Insufficient stock');
              setTimeout(() => setError(''), 2000);
              return item;
            }
            return { ...item, qty: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  // Clear cart
  const clearCart = () => {
    setCart([]);
    setShowPayment(false);
  };

  // Process payment
  const handlePayment = async () => {
    if (cart.length === 0) return;

    if (paymentMethod === 'cash' && change < 0) {
      setError('Insufficient payment');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Create transaction
      const { data: transaction, error: transactionError } = await supabase
        .from('transactions')
        .insert({
          total,
          payment_method: paymentMethod,
          cashier_id: user.id,
          status: 'completed',
        })
        .select()
        .single();

      if (transactionError) throw transactionError;

      // Create transaction items
      const items = cart.map((item) => ({
        transaction_id: transaction.id,
        product_id: item.product.id,
        qty: item.qty,
        price: item.product.price,
      }));

      const { error: itemsError } = await supabase
        .from('transaction_items')
        .insert(items);

      if (itemsError) throw itemsError;

      // Update product stock
      for (const item of cart) {
        const { error: stockError } = await supabase
          .from('products')
          .update({
            stock: item.product.stock - item.qty,
          })
          .eq('id', item.product.id);

        if (stockError) throw stockError;
      }

      // Get full transaction details
      const { data: fullTransaction } = await supabase
        .from('transactions')
        .select(`
          *,
          cashier:profiles!cashier_id(full_name),
          items:transaction_items(*, product:products(*))
        `)
        .eq('id', transaction.id)
        .single();

      setLastTransaction(fullTransaction);
      setShowPayment(false);
      setShowReceipt(true);
      clearCart();

      // Update local products
      setProducts((prev) =>
        prev.map((p) => {
          const item = cart.find((i) => i.product.id === p.id);
          if (item) {
            return { ...p, stock: p.stock - item.qty };
          }
          return p;
        })
      );
    } catch (error) {
      console.error('Payment error:', error);
      setError('Failed to process payment');
    } finally {
      setLoading(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-800">POS</h1>
          <span className="text-sm text-slate-500">Warung Sembako</span>
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="relative p-2 bg-primary text-white rounded-lg"
        >
          <ShoppingCart className="w-6 h-6" />
          {cart.length > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-secondary rounded-full text-xs flex items-center justify-center">
              {cart.length}
            </span>
          )}
        </button>
      </header>

      {/* Search & Categories */}
      <div className="bg-white border-b border-slate-200 p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search products or scan barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-lg"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setSelectedCategory('')}
            className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
              !selectedCategory
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-primary text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 rounded-lg text-sm">
            {error}
          </div>
        )}
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              className="bg-white rounded-xl border border-slate-200 p-3 text-left hover:shadow-md transition"
            >
              <div className="aspect-square bg-slate-100 rounded-lg mb-2 overflow-hidden">
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
              <h3 className="font-medium text-slate-800 text-sm truncate">
                {product.name}
              </h3>
              <p className="text-primary font-bold text-sm">
                {formatCurrency(product.price)}
              </p>
              <p className="text-xs text-slate-500">Stock: {product.stock}</p>
            </button>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No products found</p>
          </div>
        )}
      </div>

      {/* Cart Sidebar */}
      {showCart && (
        <div className="fixed inset-0 bg-black/50 z-50 flex">
          <div className="bg-white w-full max-w-md h-full flex flex-col ml-auto">
            {/* Cart Header */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Cart</h2>
              <button
                onClick={() => setShowCart(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Cart is empty</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="bg-slate-50 rounded-lg p-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-800">
                          {item.product.name}
                        </h3>
                        <p className="text-sm text-primary">
                          {formatCurrency(item.product.price)}
                        </p>
                      </div>
                      <button
                        onClick={() => removeFromCart(item.product.id)}
                        className="p-1 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQty(item.product.id, -1)}
                          className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-8 text-center font-medium">
                          {item.qty}
                        </span>
                        <button
                          onClick={() => updateQty(item.product.id, 1)}
                          className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <span className="font-semibold text-slate-800">
                        {formatCurrency(item.product.price * item.qty)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer */}
            {cart.length > 0 && (
              <div className="p-4 border-t border-slate-200 space-y-4">
                <div className="flex justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
                <button
                  onClick={() => {
                    setShowCart(false);
                    setShowPayment(true);
                  }}
                  className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition"
                >
                  Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800">Payment</h2>
              <button
                onClick={() => setShowPayment(false)}
                className="p-2 hover:bg-slate-100 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Total */}
              <div className="text-center py-4">
                <p className="text-sm text-slate-500">Total Amount</p>
                <p className="text-3xl font-bold text-primary">
                  {formatCurrency(total)}
                </p>
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Payment Method
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 border rounded-lg flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'cash'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <Banknote className="w-6 h-6" />
                    <span className="text-sm font-medium">Cash</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('qris')}
                    className={`p-3 border rounded-lg flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'qris'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <QrCode className="w-6 h-6" />
                    <span className="text-sm font-medium">QRIS</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('transfer')}
                    className={`p-3 border rounded-lg flex flex-col items-center gap-1 transition ${
                      paymentMethod === 'transfer'
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="text-sm font-medium">Transfer</span>
                  </button>
                </div>
              </div>

              {/* Cash Received (only for cash) */}
              {paymentMethod === 'cash' && (
                <div>
                  <label className="text-sm font-medium text-slate-700">
                    Cash Received
                  </label>
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                    className="w-full mt-1 px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-lg"
                    placeholder="Enter amount"
                  />
                  {change >= 0 && cashReceived && (
                    <p className="mt-2 text-green-600 font-medium">
                      Change: {formatCurrency(change)}
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handlePayment}
                disabled={
                  loading ||
                  (paymentMethod === 'cash' && change < 0)
                }
                className="w-full py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark transition disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Complete Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Receipt */}
            <div className="p-6 receipt-container" id="receipt">
              <div className="text-center border-b-2 border-dashed border-slate-300 pb-4 mb-4">
                <h2 className="text-lg font-bold text-slate-800">
                  WARUNG SEMBAKO
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Jl. Contoh No. 123
                </p>
              </div>

              <div className="text-sm space-y-2 mb-4">
                <div className="flex justify-between">
                  <span>Date:</span>
                  <span>
                    {new Date(lastTransaction.created_at).toLocaleDateString(
                      'id-ID'
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>TRX:</span>
                  <span className="font-mono">
                    {lastTransaction.id.slice(0, 8)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cashier:</span>
                  <span>{lastTransaction.cashier?.full_name || 'Unknown'}</span>
                </div>
              </div>

              <div className="border-t border-b border-slate-200 py-2 mb-4">
                <div className="grid grid-cols-12 text-xs font-medium text-slate-600">
                  <div className="col-span-6">Item</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-4 text-right">Price</div>
                </div>
              </div>

              <div className="space-y-1 mb-4">
                {lastTransaction.items?.map((item: any) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 text-xs"
                  >
                    <div className="col-span-6 truncate">
                      {item.product?.name}
                    </div>
                    <div className="col-span-2 text-center">{item.qty}</div>
                    <div className="col-span-4 text-right">
                      {formatCurrency(item.price * item.qty)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-200 pt-2 mb-4">
                <div className="flex justify-between font-bold">
                  <span>TOTAL</span>
                  <span>{formatCurrency(lastTransaction.total)}</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span>Payment:</span>
                  <span className="capitalize">{lastTransaction.payment_method}</span>
                </div>
                {lastTransaction.payment_method === 'cash' && cashReceived && (
                  <div className="flex justify-between text-sm">
                    <span>Cash:</span>
                    <span>{formatCurrency(parseFloat(cashReceived))}</span>
                  </div>
                )}
                {lastTransaction.payment_method === 'cash' && cashReceived && (
                  <div className="flex justify-between text-sm">
                    <span>Change:</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                )}
              </div>

              <div className="text-center text-xs text-slate-500 border-t-2 border-dashed border-slate-300 pt-4">
                <p>Thank you for your purchase!</p>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => {
                  setShowReceipt(false);
                  setCashReceived('');
                }}
                className="flex-1 py-3 border border-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition flex items-center justify-center gap-2"
              >
                <Printer className="w-5 h-5" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
