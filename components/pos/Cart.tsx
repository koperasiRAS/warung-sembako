import { CartItem } from '@/types';
import { Button } from '@/components/ui';

export interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemoveItem: (productId: string) => void;
  onClearCart: () => void;
}

export function Cart({ items, onUpdateQuantity, onRemoveItem, onClearCart }: CartProps) {
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 py-8">
        <svg className="w-16 h-16 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
        <p className="text-slate-400">Cart is empty</p>
        <p className="text-sm text-slate-400 mt-1">Tap products to add</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between pb-3 border-b border-slate-200">
        <h3 className="font-semibold text-slate-900">Cart ({items.length})</h3>
        <Button variant="ghost" size="sm" onClick={onClearCart}>
          Clear
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-2">
        {items.map((item) => (
          <div
            key={item.product_id}
            className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {item.product_name}
              </p>
              <p className="text-sm text-slate-500">
                Rp {Number(item.price).toLocaleString('id-ID')}
              </p>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateQuantity(item.product_id, item.quantity - 1)}
                className="w-7 h-7 flex items-center justify-center rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
              >
                -
              </button>
              <span className="w-8 text-center text-sm font-medium">
                {item.quantity}
              </span>
              <button
                onClick={() => onUpdateQuantity(item.product_id, item.quantity + 1)}
                className="w-7 h-7 flex items-center justify-center rounded bg-slate-200 text-slate-600 hover:bg-slate-300 transition-colors"
              >
                +
              </button>
            </div>

            <button
              onClick={() => onRemoveItem(item.product_id)}
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <span className="text-lg font-semibold text-slate-900">Total</span>
          <span className="text-xl font-bold text-teal-600">
            Rp {total.toLocaleString('id-ID')}
          </span>
        </div>
      </div>
    </div>
  );
}